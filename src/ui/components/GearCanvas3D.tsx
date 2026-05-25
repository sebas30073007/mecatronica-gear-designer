import { useEffect, useRef } from 'react';
import type * as T3 from 'three';
import type { SpurGear, ViewMode } from '../../core/gearTypes';
import { generateSpurGearOutline } from '../../geometry/spurGear2D';
import { generateBoreOutline } from '../../geometry/borePath';

type TM = typeof T3;

const RED   = 0xc8202a;
const GRID  = 0xf2c8cc;
const OMEGA = 0.008;

const FRONT_FOV = 18, ISO_FOV = 34;
const DEG2RAD   = Math.PI / 180;
const ISO_LEN   = Math.sqrt(1.02 * 1.02 + 0.82 * 0.82);
const ISO_Y     = 1.02 / ISO_LEN, ISO_Z = 0.82 / ISO_LEN;

const lerp      = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => t * t * (3 - 2 * t);
const wrapAngle = (a: number) => { const r = ((a % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI); return r > Math.PI ? r - 2*Math.PI : r; };

interface Props { g1: SpurGear; g2: SpurGear; moduleMm: number; pa: number; viewMode: ViewMode; }

// Gear profile in XY plane, thickness along Z — no rotateX
function buildGearGeo(THREE: TM, gear: SpurGear, moduleMm: number, pa: number) {
  const prof  = generateSpurGearOutline({ teeth: gear.teeth, moduleMm, pressureAngleDeg: pa });
  const shape = new THREE.Shape();
  prof.outline.forEach((p, i) => i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y));
  shape.closePath();
  const boreD   = Math.max(gear.boreDiameterMm, moduleMm * 2);
  const borePts = generateBoreOutline(gear.boreType, boreD);
  if (borePts.length > 0) {
    const hole = new THREE.Path();
    borePts.forEach((p, i) => { if (i === 0) hole.moveTo(p.x, p.y); else hole.lineTo(p.x, p.y); });
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(gear.thicknessMm, 2), bevelEnabled: false, curveSegments: 12,
  });
  geo.center();
  return geo;
}

export default function GearCanvas3D({ g1, g2, moduleMm, pa, viewMode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const threeRef  = useRef<TM | null>(null);
  const cameraRef = useRef<T3.PerspectiveCamera | null>(null);
  const groupRef  = useRef<T3.Group | null>(null);
  const gridRef   = useRef<T3.GridHelper | null>(null);
  const pivot1Ref = useRef<T3.Group | null>(null);
  const pivot2Ref = useRef<T3.Group | null>(null);
  const oldGeoRef = useRef<(() => void) | null>(null);
  const ratioRef  = useRef({ z1: g1.teeth, z2: g2.teeth });
  const spinRef   = useRef({ s1: 0, s2: 0 });
  const scRef     = useRef(1);
  const boundRef  = useRef(3.5);
  const targetRef = useRef(viewMode === '3d' ? 1 : 0);

  function rebuildGears(THREE: TM) {
    const group  = groupRef.current;
    const pivot1 = pivot1Ref.current;
    const pivot2 = pivot2Ref.current;
    if (!group || !pivot1 || !pivot2) return;

    const R1_mm    = (g1.teeth * moduleMm) / 2;
    const SC       = 3.5 / R1_mm;
    const cd       = (g1.teeth + g2.teeth) * moduleMm / 2;
    const R1_outer = (g1.teeth + 2) * moduleMm / 2;

    scRef.current    = SC;
    boundRef.current = (cd / 2 + R1_outer) * SC * 1.1;

    pivot1.position.x = -cd / 2;
    pivot2.position.x =  cd / 2;

    const geo1 = buildGearGeo(THREE, g1, moduleMm, pa);
    const geo2 = buildGearGeo(THREE, g2, moduleMm, pa);
    const e1   = new THREE.EdgesGeometry(geo1, 12);
    const e2   = new THREE.EdgesGeometry(geo2, 12);

    const makeFill  = (geo: T3.BufferGeometry) => new THREE.Mesh(geo,
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
    const makeLines = (eg: T3.BufferGeometry) =>
      new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: RED }));

    [pivot1, pivot2].forEach(p => { while (p.children.length) p.remove(p.children[0]!); });
    pivot1.add(makeFill(geo1), makeLines(e1));
    pivot2.add(makeFill(geo2), makeLines(e2));

    oldGeoRef.current?.();
    oldGeoRef.current = () => { geo1.dispose(); geo2.dispose(); e1.dispose(); e2.dispose(); };

    ratioRef.current = { z1: g1.teeth, z2: g2.teeth };
    spinRef.current  = { s1: 0, s2: (g2.teeth - 1) * Math.PI / g2.teeth };
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
      cameraRef.current = camera;

      const group = new THREE.Group();
      groupRef.current = group;
      scene.add(group);

      const pivot1 = new THREE.Group(); pivot1Ref.current = pivot1;
      const pivot2 = new THREE.Group(); pivot2Ref.current = pivot2;
      group.add(pivot1, pivot2);

      // Grid: rotates from vertical (2D) to horizontal floor (3D) during transition
      const grid = new THREE.GridHelper(80, 40, GRID, GRID);
      (grid.material as T3.Material).transparent = true;
      (grid.material as T3.Material).opacity = 0.3;
      gridRef.current = grid;
      scene.add(grid);

      rebuildGears(THREE);

      let progress   = targetRef.current;
      let prevTarget = targetRef.current;
      let rotY = viewMode === '3d' ? 0.4 : 0;
      let rotX = viewMode === '3d' ? 0.2 : 0;
      let dragging = false, lx = 0, ly = 0;

      // Drag: only active in 3D mode
      const onDown = (e: PointerEvent) => { dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); };
      const onUp   = () => { dragging = false; };
      const onMove = (e: PointerEvent) => {
        if (!dragging || targetRef.current < 0.5) return;   // no drag in 2D
        rotY += (e.clientX - lx) * 0.01; lx = e.clientX;
        rotX += (e.clientY - ly) * 0.01; ly = e.clientY;
        rotX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, rotX));
      };
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointerup',   onUp);
      canvas.addEventListener('pointermove', onMove);

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

        // Detect 3D→2D transition: wrap accumulated rotation to shortest path
        const curTarget = targetRef.current;
        if (curTarget !== prevTarget) {
          if (curTarget < 0.5 && prevTarget >= 0.5) {
            rotY = wrapAngle(rotY);
            rotX = Math.max(-0.5, Math.min(0.5, rotX));
          }
          prevTarget = curTarget;
        }

        // Transition progress
        progress += (curTarget - progress) * 0.055;
        const p = easeInOut(Math.max(0, Math.min(1, progress)));

        // Camera lerp
        const sb = boundRef.current;
        const fd = sb / Math.tan((FRONT_FOV / 2) * DEG2RAD) * 1.1;
        const id = sb / Math.tan((ISO_FOV  / 2) * DEG2RAD) * 1.44;
        camera.position.set(0, lerp(0, ISO_Y * id, p), lerp(fd, ISO_Z * id, p));
        camera.fov = lerp(FRONT_FOV, ISO_FOV, p);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();

        // Scale z (thickness illusion)
        const sc = scRef.current;
        group.scale.set(sc, sc, sc * lerp(0.003, 1.0, p));

        // Orbital rotation — NO auto-spin; only return to 0 when in 2D mode
        if (!dragging && curTarget < 0.5) { rotY *= 0.92; rotX *= 0.92; }
        group.rotation.y = rotY;
        group.rotation.x = rotX;

        // Grid: vertical background in 2D, horizontal floor in 3D
        const grd = gridRef.current!;
        grd.rotation.x = lerp(Math.PI / 2, 0, p);
        grd.position.y = lerp(0, -sb * 1.1, p);
        grd.position.z = lerp(-sb * 0.5,  0, p);
        (grd.material as T3.Material).opacity = lerp(0.3, 0.55, p);

        // Gear spin on Z
        const { z1, z2 } = ratioRef.current;
        spinRef.current.s2 += OMEGA;
        spinRef.current.s1 -= OMEGA * (z2 / z1);
        pivot1.rotation.z = spinRef.current.s1;
        pivot2.rotation.z = spinRef.current.s2;

        renderer.render(scene, camera);
      };
      tick();

      dispose = () => {
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointerup',   onUp);
        canvas.removeEventListener('pointermove', onMove);
        ro.disconnect();
        cancelAnimationFrame(raf);
        oldGeoRef.current?.();
        renderer.dispose();
        threeRef.current = cameraRef.current = groupRef.current = null;
        pivot1Ref.current = pivot2Ref.current = null;
      };
    })();

    return () => { cancelled = true; dispose(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { targetRef.current = viewMode === '3d' ? 1 : 0; }, [viewMode]);

  useEffect(() => {
    const THREE = threeRef.current;
    if (!THREE) return;
    rebuildGears(THREE);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g1.teeth, g2.teeth, g1.boreDiameterMm, g2.boreDiameterMm, moduleMm, pa, g1.thicknessMm, g2.thicknessMm]);

  return <div className="gear3d-wrap"><canvas ref={canvasRef} className="gear3d-canvas" /></div>;
}
