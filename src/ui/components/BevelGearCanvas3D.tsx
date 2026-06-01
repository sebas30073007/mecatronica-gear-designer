import { useEffect, useRef, useState } from 'react';
import type * as T3 from 'three';
import type { BevelParams } from '../../core/gearTypes';
import { generateSpurGearOutline } from '../../geometry/spurGear2D';

type TM = typeof T3;

const DEBOUNCE_MS = 700;
const RED     = 0xc8202a;
const GRID    = 0xf2c8cc;
const OMEGA   = 0.007;
const DEG2RAD = Math.PI / 180;
const ISO_FOV = 34;
const ISO_LEN = Math.sqrt(1.02 * 1.02 + 0.82 * 0.82);
const ISO_Y   = 1.02 / ISO_LEN;
const ISO_Z   = 0.82 / ISO_LEN;

/**
 * Builds one bevel gear body as a tapered extrusion.
 *
 * Coordinate convention used here:
 *   z = 0        → TOE  (small inner face, placed near the cone apex)
 *   z = axDepth  → HEEL (large outer face, back cone)
 *
 * The radial taper goes from `taper = (L - b) / L` at the toe to 1.0 at the heel,
 * matching the pitch-cone geometry exactly (L = m/2 · √(z1² + z2²)).
 *
 * `axDepth` is the face-width projected onto the gear's own axis: b · cos(δ).
 */
function buildBevelGeo(
  THREE: TM,
  teeth: number,
  partnerTeeth: number,
  moduleMm: number,
  pa: number,
  faceWidthSlant: number,
  axialDepth: number,
): T3.BufferGeometry {
  const L     = (moduleMm / 2) * Math.sqrt(teeth ** 2 + partnerTeeth ** 2);
  const taper = Math.max(0.20, (L - faceWidthSlant) / L);

  const prof  = generateSpurGearOutline({ teeth, moduleMm, pressureAngleDeg: pa });
  const shape = new THREE.Shape();
  prof.outline.forEach((p, i) => i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y));
  shape.closePath();

  const boreR = Math.max(moduleMm * 1.4, prof.rootRadius * 0.28);
  const hole  = new THREE.Path();
  for (let i = 0; i <= 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    i === 0 ? hole.moveTo(Math.cos(a) * boreR, Math.sin(a) * boreR)
             : hole.lineTo(Math.cos(a) * boreR, Math.sin(a) * boreR);
  }
  shape.holes.push(hole);

  const depth = Math.max(axialDepth, 2);
  const geo   = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: false, steps: 14, curveSegments: 1,
  });

  // Radial taper: z=0 → taper (toe/small), z=depth → 1.0 (heel/full)
  const pos = geo.attributes.position as T3.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const s = taper + (z / depth) * (1 - taper);
    pos.setXY(i, pos.getX(i) * s, pos.getY(i) * s);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export default function BevelGearCanvas3D({
  pinionTeeth, gearTeeth, moduleMm, pressureAngleDeg, faceWidthMm,
}: BevelParams) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const threeRef    = useRef<TM | null>(null);
  const masterRef   = useRef<T3.Group | null>(null);
  // orient1: aligns pinion axis with world +Y  (rotation.x = -π/2 → local Z = world +Y)
  // orient2: aligns gear   axis with world +X  (rotation.y = +π/2 → local Z = world +X)
  const orient1Ref  = useRef<T3.Group | null>(null);
  const orient2Ref  = useRef<T3.Group | null>(null);
  const pivot1Ref   = useRef<T3.Group | null>(null);
  const pivot2Ref   = useRef<T3.Group | null>(null);
  const gridRef     = useRef<T3.GridHelper | null>(null);
  const oldGeoRef   = useRef<(() => void) | null>(null);
  const boundRef    = useRef(3.0);
  const ratioRef    = useRef({ z1: pinionTeeth, z2: gearTeeth });
  const spinRef     = useRef({ s1: 0, s2: 0 });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomRef     = useRef(1.0);
  const [isLoading, setIsLoading] = useState(false);

  function rebuildGears(THREE: TM) {
    const master  = masterRef.current;
    const orient1 = orient1Ref.current;
    const orient2 = orient2Ref.current;
    const pivot1  = pivot1Ref.current;
    const pivot2  = pivot2Ref.current;
    const grid    = gridRef.current;
    if (!master || !orient1 || !orient2 || !pivot1 || !pivot2) return;

    // ── Bevel geometry maths ───────────────────────────────────────────────
    // δ1 = cone half-angle of pinion  (from its own axis)
    // δ2 = cone half-angle of gear    (from its own axis)   δ1 + δ2 = 90°
    const δ1 = Math.atan2(pinionTeeth, gearTeeth);
    const δ2 = Math.PI / 2 - δ1;

    // Outer pitch radii
    const r1 = pinionTeeth * moduleMm / 2;
    const r2 = gearTeeth   * moduleMm / 2;
    // Outer tip radii (for scene bounds)
    const r1out = (pinionTeeth + 2) * moduleMm / 2;
    const r2out = (gearTeeth   + 2) * moduleMm / 2;

    // Axial depth: face-width projected onto each gear's own axis
    const axD1 = faceWidthMm * Math.cos(δ1);
    const axD2 = faceWidthMm * Math.cos(δ2);

    // KEY RELATIONSHIP for 90° bevel gears
    // Pinion heel (outer back-cone) is at distance r2 along +Y from the apex.
    // Gear   heel (outer back-cone) is at distance r1 along +X from the apex.
    //   (derivation: L·cos(δ1) = r2,  L·cos(δ2) = r1)
    const heelY = r2;       // where pinion's large face sits on the Y axis
    const heelX = r1;       // where gear's   large face sits on the X axis
    const toeY  = heelY - axD1;   // small face of pinion
    const toeX  = heelX - axD2;   // small face of gear

    // Place orient groups so local z=0 (toe) sits at toeY / toeX in master space.
    // After orient1.rotation.x=-π/2: local +Z → world +Y, so position.y = toeY.
    // After orient2.rotation.y=+π/2: local +Z → world +X, so position.x = toeX.
    orient1.position.set(0,    toeY, 0);
    orient2.position.set(toeX, 0,    0);

    // ── Scale to fill the viewport ─────────────────────────────────────────
    // Visible extents in master-local space (approximate):
    //   X: from -r1out (pinion radial left)  to heelX + r2out (gear heel + tip)
    //   Y: from -r2out (gear radial bottom)  to heelY + r1out (pinion heel + tip)
    const extX = r1out + heelX + r2out;
    const extY = r2out + heelY + r1out;
    const SC   = 2.8 / Math.max(extX, extY);
    master.scale.setScalar(SC);

    // Center: offset master so the L-shape is centred on world origin
    master.position.set(
      -SC * (heelX + r2out - r1out) / 2,
      -SC * (heelY + r1out - r2out) / 2,
      0
    );

    boundRef.current = 2.8;
    if (grid) grid.position.y = -3.6;

    // ── Build mesh geometry ────────────────────────────────────────────────
    const geo1 = buildBevelGeo(THREE, pinionTeeth, gearTeeth, moduleMm, pressureAngleDeg, faceWidthMm, axD1);
    const geo2 = buildBevelGeo(THREE, gearTeeth, pinionTeeth, moduleMm, pressureAngleDeg, faceWidthMm, axD2);
    const e1   = new THREE.EdgesGeometry(geo1, 12);
    const e2   = new THREE.EdgesGeometry(geo2, 12);

    const makeFill  = (g: T3.BufferGeometry) => new THREE.Mesh(g,
      new THREE.MeshBasicMaterial({
        color: 0xffffff, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
      }));
    const makeLines = (g: T3.BufferGeometry) =>
      new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: RED }));

    [pivot1, pivot2].forEach(p => { while (p.children.length) p.remove(p.children[0]!); });
    pivot1.add(makeFill(geo1), makeLines(e1));
    pivot2.add(makeFill(geo2), makeLines(e2));

    oldGeoRef.current?.();
    oldGeoRef.current = () => { geo1.dispose(); geo2.dispose(); e1.dispose(); e2.dispose(); };

    ratioRef.current = { z1: pinionTeeth, z2: gearTeeth };

    // ── Initial tooth phase ────────────────────────────────────────────────
    // After orient1.rotation.x=-π/2 the gear's local X maps to world X.
    // At s1=0 the first pinion tooth tip points in local +X = world +X.
    // The gear (orient2.rotation.y=+π/2) has local X → world +Z.
    // To bring a gear TOOTH GAP to face world +Y (toward the pinion),
    // rotate gear by +90° (π/2) plus half a tooth pitch (π/z2).
    spinRef.current = {
      s1: 0,
      s2: Math.PI / 2 + Math.PI / gearTeeth,
    };
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false, dispose = () => {};

    (async () => {
      const THREE = await import('three');
      if (cancelled) return;
      threeRef.current = THREE;

      const w = canvas.clientWidth || 900, h = canvas.clientHeight || 550;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0xffffff, 1);

      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(ISO_FOV, w / h, 0.1, 5000);

      const master = new THREE.Group();
      masterRef.current = master;
      scene.add(master);

      // orient1: local Z → world +Y  (pinion axis along Y)
      const orient1 = new THREE.Group();
      orient1.rotation.x = -Math.PI / 2;
      orient1Ref.current = orient1;

      // orient2: local Z → world +X  (gear axis along X)
      const orient2 = new THREE.Group();
      orient2.rotation.y = Math.PI / 2;
      orient2Ref.current = orient2;

      const pivot1 = new THREE.Group(); pivot1Ref.current = pivot1;
      const pivot2 = new THREE.Group(); pivot2Ref.current = pivot2;
      orient1.add(pivot1);
      orient2.add(pivot2);
      master.add(orient1, orient2);

      const grid = new THREE.GridHelper(80, 40, GRID, GRID);
      (grid.material as T3.Material).transparent = true;
      (grid.material as T3.Material).opacity = 0.5;
      gridRef.current = grid;
      scene.add(grid);

      rebuildGears(THREE);

      let rotY = 0.4, rotX = 0.22, dragging = false, lx = 0, ly = 0;

      const onDown  = (e: PointerEvent) => { dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); };
      const onUp    = () => { dragging = false; };
      const onMove  = (e: PointerEvent) => {
        if (!dragging) return;
        rotY += (e.clientX - lx) * 0.01; lx = e.clientX;
        rotX += (e.clientY - ly) * 0.01; ly = e.clientY;
        rotX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, rotX));
      };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        zoomRef.current = Math.max(0.2, Math.min(5.0, zoomRef.current * (e.deltaY > 0 ? 0.9 : 1.1)));
      };
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointerup',   onUp);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('wheel', onWheel, { passive: false });

      const ro = new ResizeObserver(() => {
        const cw = canvas.clientWidth, ch = canvas.clientHeight;
        if (!cw || !ch) return;
        renderer.setSize(cw, ch, false);
        camera.aspect = cw / ch;
        camera.updateProjectionMatrix();
      });
      ro.observe(canvas);

      let raf = 0;
      const tick = () => {
        raf = requestAnimationFrame(tick);

        const sb      = boundRef.current;
        const camDist = sb / Math.tan((ISO_FOV / 2) * DEG2RAD) * 1.44;
        const zoom    = zoomRef.current;
        camera.position.set(0, ISO_Y * camDist * zoom, ISO_Z * camDist * zoom);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();

        master.rotation.y = rotY;
        master.rotation.x = rotX;

        // Velocity analysis for 90° bevel gears confirms:
        // ω_pinion(+Y) and ω_gear(+X) must satisfy ω_gear = -ω_pinion · z1/z2
        // so that tangential velocities at the contact are equal and opposite (meshing).
        const { z1, z2 } = ratioRef.current;
        spinRef.current.s1 += OMEGA;
        spinRef.current.s2 -= OMEGA * (z1 / z2);
        pivot1.rotation.z = spinRef.current.s1;
        pivot2.rotation.z = spinRef.current.s2;

        renderer.render(scene, camera);
      };
      tick();

      dispose = () => {
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointerup',   onUp);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('wheel', onWheel);
        ro.disconnect();
        cancelAnimationFrame(raf);
        oldGeoRef.current?.();
        renderer.dispose();
        threeRef.current = masterRef.current = null;
        orient1Ref.current = orient2Ref.current = null;
        pivot1Ref.current = pivot2Ref.current = null;
        gridRef.current = null;
      };
    })();

    return () => { cancelled = true; dispose(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!threeRef.current) return;
    setIsLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const T = threeRef.current;
        if (T) rebuildGears(T);
        setIsLoading(false);
      }));
    }, DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinionTeeth, gearTeeth, moduleMm, pressureAngleDeg, faceWidthMm]);

  return (
    <div className="gear3d-wrap">
      <canvas ref={canvasRef} className="gear3d-canvas" />
      {isLoading && <div className="gear3d-loading"><div className="gear3d-spinner" /></div>}
    </div>
  );
}
