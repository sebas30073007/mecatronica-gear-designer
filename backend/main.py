import math
import os
import tempfile
from typing import Literal, Optional

import cadquery as cq
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

from gear_geometry import spur_gear_outline, rack_profile_2d

app = FastAPI(title="Gear STEP API", version="1.0.0")

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)


class SpurGearRequest(BaseModel):
    teeth: int = Field(..., ge=8, le=400)
    module_mm: float = Field(..., gt=0.3, le=50.0)
    pressure_angle_deg: float = Field(20.0, ge=10.0, le=30.0)
    thickness_mm: float = Field(..., gt=0.5, le=500.0)
    bore_mm: Optional[float] = Field(None, ge=0.0)
    bore_type: Literal["round", "d-shaft", "keyway", "none"] = "round"
    label: str = Field("gear", max_length=64)


def _build_solid(pts, thickness_mm: float) -> cq.Workplane:
    vectors = [cq.Vector(x, y, 0) for x, y in pts]
    wire    = cq.Wire.makePolygon(vectors, close=True)
    solid   = cq.Solid.extrudeLinear(wire, [], cq.Vector(0, 0, thickness_mm))
    return cq.Workplane("XY").add(solid)


def _apply_bore(result: cq.Workplane, bore_mm: float, bore_type: str) -> cq.Workplane:
    bore_r = bore_mm / 2

    # Circular bore (always)
    result = result.faces(">Z").workplane().circle(bore_r).cutThruAll()

    if bore_type == "d-shaft":
        # Flat chord at 72% of bore radius from center
        flat_y   = bore_r * 0.72
        cut_h    = (bore_r - flat_y + 2.0)
        center_y = flat_y + cut_h / 2
        result = (result.faces(">Z").workplane()
                  .transformed(offset=cq.Vector(0, center_y, 0))
                  .rect(bore_mm * 2, cut_h)
                  .cutThruAll())

    elif bore_type == "keyway":
        # DIN 6885: width ≈ d/4; full key height ≈ width (square section, visually proportional)
        key_w    = bore_mm / 4
        key_d    = key_w               # full key height cut into gear for clear geometry
        center_y = bore_r + key_d / 2
        result = (result.faces(">Z").workplane()
                  .transformed(offset=cq.Vector(0, center_y, 0))
                  .rect(key_w, key_d)
                  .cutThruAll())

    return result


def build_spur_step(req: SpurGearRequest) -> bytes:
    pts = spur_gear_outline(
        teeth=req.teeth,
        module_mm=req.module_mm,
        pressure_angle_deg=req.pressure_angle_deg,
        quality=16,
    )
    result = _build_solid(pts, req.thickness_mm)

    if req.bore_mm and req.bore_mm > 0 and req.bore_type != "none":
        root_r  = req.module_mm * (req.teeth - 2.5) / 2
        bore_mm = min(req.bore_mm, root_r * 1.6)  # clamp to 80% of root diameter
        if bore_mm > 0.5:
            result = _apply_bore(result, bore_mm, req.bore_type)

    with tempfile.NamedTemporaryFile(suffix=".step", delete=False) as f:
        tmp = f.name
    try:
        cq.exporters.export(result, tmp)
        with open(tmp, "rb") as f:
            return f.read()
    finally:
        os.unlink(tmp)


@app.post("/step-export/spur")
async def step_export_spur(req: SpurGearRequest):
    try:
        data = build_spur_step(req)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    filename = f"gear-{req.label}-{req.teeth}T-M{req.module_mm}.step"
    return Response(
        content=data,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


class RingGearRequest(BaseModel):
    ring_teeth: int = Field(..., ge=20, le=400)
    module_mm: float = Field(..., gt=0.3, le=50.0)
    pressure_angle_deg: float = Field(20.0, ge=10.0, le=30.0)
    thickness_mm: float = Field(..., gt=0.5, le=500.0)
    wall_thickness_mm: float = Field(3.0, ge=0.5, le=50.0)
    label: str = Field("ring-gear", max_length=64)


def build_ring_gear_step(req: RingGearRequest) -> bytes:
    # The ring gear is built by subtracting an external spur gear solid from a disk.
    # The external spur gear's tooth profile forms the internal teeth of the ring.
    gear_pts = spur_gear_outline(
        teeth=req.ring_teeth,
        module_mm=req.module_mm,
        pressure_angle_deg=req.pressure_angle_deg,
        quality=16,
    )
    # Outer radius sits just beyond the spur gear tip circle plus wall thickness
    outer_r = req.module_mm * (req.ring_teeth + 2) / 2 + req.wall_thickness_mm
    outer_disk = cq.Workplane("XY").circle(outer_r).extrude(req.thickness_mm)
    gear_wp    = _build_solid(gear_pts, req.thickness_mm)
    result     = outer_disk.cut(gear_wp)

    with tempfile.NamedTemporaryFile(suffix=".step", delete=False) as f:
        tmp = f.name
    try:
        cq.exporters.export(result, tmp)
        with open(tmp, "rb") as f:
            return f.read()
    finally:
        os.unlink(tmp)


@app.post("/step-export/ring-gear")
async def step_export_ring_gear(req: RingGearRequest):
    try:
        data = build_ring_gear_step(req)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    filename = f"gear-{req.label}-{req.ring_teeth}T-M{req.module_mm}.step"
    return Response(
        content=data,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


class RackRequest(BaseModel):
    n_teeth: int = Field(..., ge=3, le=200)
    module_mm: float = Field(..., gt=0.3, le=50.0)
    pressure_angle_deg: float = Field(20.0, ge=10.0, le=30.0)
    thickness_mm: float = Field(..., gt=0.5, le=500.0)
    label: str = Field("rack", max_length=64)


def build_rack_step(req: RackRequest) -> bytes:
    pts    = rack_profile_2d(req.n_teeth, req.module_mm, req.pressure_angle_deg)
    result = _build_solid(pts, req.thickness_mm)

    with tempfile.NamedTemporaryFile(suffix=".step", delete=False) as f:
        tmp = f.name
    try:
        cq.exporters.export(result, tmp)
        with open(tmp, "rb") as f:
            return f.read()
    finally:
        os.unlink(tmp)


@app.post("/step-export/rack")
async def step_export_rack(req: RackRequest):
    try:
        data = build_rack_step(req)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    filename = f"rack-{req.label}-{req.n_teeth}T-M{req.module_mm}.step"
    return Response(
        content=data,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/health")
def health():
    return {"status": "ok", "service": "gear-step-api"}
