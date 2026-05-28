import math
import os
import tempfile
from typing import Literal, Optional

import cadquery as cq
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

from gear_geometry import spur_gear_outline

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
        # Rectangular slot protruding from bore surface (standard: w=d/4, depth=d/8)
        key_w    = bore_mm / 4
        key_d    = bore_mm / 8
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


@app.get("/health")
def health():
    return {"status": "ok", "service": "gear-step-api"}
