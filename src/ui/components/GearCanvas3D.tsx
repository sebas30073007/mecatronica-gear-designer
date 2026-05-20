import { useEffect, useRef, useState } from 'react';
import type * as T3 from 'three';
import type { SpurGear } from '../../core/gearTypes';
import { generateSpurGearOutline } from '../../geometry/spurGear2D';

type GearStyle = 'blueprint' | 'wireframe';
type TM = typeof T3;

const RED   = 0xc8202a;
const GRID  = 0xf2c8cc;
const OMEGA = 0.008;   // rad/frame — driver angular speed

interface Props { g1: SpurGear; g2: SpurGear; moduleMm: number; pa: number; }

// ── Pure helpers (no React deps) ─────────────────────────────────────────────

function buildGearGeo(THREE: TM, gear: SpurGear, moduleMm: number, pa: number, minThickMm: number) {
  const prof  = generateSpurGearOutline({ teeth: gear.teeth, moduleMm, pressureAngleDeg: pa });
  const shape = new THREE.Shape();
  prof.outline.forEach((p, i) => i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y));
  shape.closePath();

  const boreR = Math.max(prof.rootRadius * 0.28, moduleMm);
  const hole  = new THREE.Path();
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    if (i === 0) hole.moveTo(Math.cos(a) * boreR, Math.sin(a) * boreR);
    else         hole.lineTo(Math.cos(a) * boreR, Math.sin(a) * boreR);
  }
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(gear.thicknessMm, minThickMm),
    bevelEnabled: false, curveSegments: 12,
  });
  geo.center();
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function fitCamera(THREE: TM, camera: T3.PerspectiveCamera, g1: SpurGear, g2: SpurGear, moduleMm: number, SC: number) {
  const cd        = (g1.teeth + g2.teeth) * moduleMm / 2;
  const R1_outer  = (g1.teeth + 2) * moduleMm / 2;
  const bound     = (cd / 2 + R1_outer) * SC;
  const dist      = (bound / Math.sin((35 / 2) * (Math.PI / 180))) * 1.35;
  camera.position.copy(new THREE.Vector3(9, 6.5, 11).normalize().multiplyScalar(dist));
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  return bound;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function GearCanvas3D({ g1, g2, moduleMm, pa }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [style, setStyle] = useState<GearStyle>('blueprint');

  // Scene object refs (populated after Three.js loads)
  const threeRef  = useRef<TM | null>(null);
  const cameraRef = useRef<T3.PerspectiveCamera | null>(null);
  const groupRef  = useRef<T3.Group | null>(null);
  const gridRef   = useRef<T3.GridHelper | null>(null);
  const pivot1Ref = useRef<T3.Group | null>(null);   // g1 spin pivot
  const pivot2Ref = useRef<T3.Group | null>(null);   // g2 spin pivot
  const fillsRef  = useRef<T3.Mesh[]>([]);
  const oldGeoRef = useRef<(() => void) | null>(null); // dispose callback

  // Live animation state (read by tick loop)
  const styleRef      = useRef<GearStyle>('blueprint');
  const applyStyleRef = useRef<((s: GearStyle) => void) | null>(null);
  const ratioRef      = useRef({ z1: g1.teeth, z2: g2.teeth });
  const spinRef       = useRef({ s1: 0, s2: 0 });

  // ── Rebuild gear content inside existing pivots ───────────────────────────
  function rebuildGears(THREE: TM) {
    const group  = groupRef.current;
    const pivot1 = pivot1Ref.current;
    const pivot2 = pivot2Ref.current;
    if (!group || !pivot1 || !pivot2) return;

    const R1_mm    = (g1.teeth * moduleMm) / 2;
    const SC       = 3.5 / R1_mm;
    const minThick = R1_mm * 0.4;
    const cd       = (g1.teeth + g2.teeth) * moduleMm / 2;

    // Update group scale + pivot positions
    group.scale.setScalar(SC);
    pivot1.position.x = -cd / 2;
    pivot2.position.x =  cd / 2;

    // Fit camera
    const bound = fitCamera(THREE, cameraRef.current!, g1, g2, moduleMm, SC);

    // Update grid position
    if (gridRef.current) gridRef.current.position.y = -(bound * 1.1);

    // Build new geometries
    const geo1 = buildGearGeo(THREE, g1, moduleMm, pa, minThick);
    const geo2 = buildGearGeo(THREE, g2, moduleMm, pa, minThick);
    const e1   = new THREE.EdgesGeometry(geo1, 12);
    const e2   = new THREE.EdgesGeometry(geo2, 12);

    const makeFill = (geo: T3.BufferGeometry) => new THREE.Mesh(geo,
      new THREE.MeshBasicMaterial({
        color: 0xffffff, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
      })
    );
    const makeLines = (eg: T3.BufferGeometry) =>
      new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: RED }));

    const fill1  = makeFill(geo1);
    const fill2  = makeFill(geo2);
    const lines1 = makeLines(e1);
    const lines2 = makeLines(e2);

    // Swap children
    [pivot1, pivot2].forEach(p => { while (p.children.length) p.remove(p.children[0]!); });
    pivot1.add(fill1, lines1);
    pivot2.add(fill2, lines2);

    // Track fills for style toggle
    fillsRef.current = [fill1, fill2];

    // Apply current style immediately
    const s = styleRef.current;
    fill1.visible = fill2.visible = s === 'wireframe';

    // Dispose old, register new
    oldGeoRef.current?.();
    oldGeoRef.current = () => { geo1.dispose(); geo2.dispose(); e1.dispose(); e2.dispose(); };

    // Update animation state
    ratioRef.current = { z1: g1.teeth, z2: g2.teeth };
    spinRef.current  = { s1: 0, s2: Math.PI / g2.teeth }; // half-tooth offset for mesh
  }

  // ── Initial Three.js bootstrap (once) ───────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false, dispose = () => {};

    (async () => {
      const THREE = await import('three');
      if (cancelled) return;
      threeRef.current = THREE;

      const w = canvas.clientWidth || 900, h = canvas.clientHeight || 550;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0xffffff, 1);

      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 5000);
      cameraRef.current = camera;

      // Group: orbital rotation controlled by drag
      const group = new THREE.Group();
      group.rotation.y = 0.4;
      group.rotation.x = 0.2;
      groupRef.current = group;
      scene.add(group);

      // Pivots: individual gear spin (children swapped on rebuild)
      const pivot1 = new THREE.Group(); pivot1Ref.current = pivot1;
      const pivot2 = new THREE.Group(); pivot2Ref.current = pivot2;
      group.add(pivot1, pivot2);

      // Grid — always visible in both styles (depth cue)
      const grid = new THREE.GridHelper(40, 30, GRID, GRID);
      grid.position.y = -3;
      (grid.material as T3.Material).transparent = true;
      (grid.material as T3.Material).opacity = 0.65;
      gridRef.current = grid;
      scene.add(grid);

      // Build geometry for the initial props
      rebuildGears(THREE);

      // Style: only toggle fills; grid always stays on
      applyStyleRef.current = (s: GearStyle) => {
        fillsRef.current.forEach(f => (f.visible = s === 'wireframe'));
      };
      applyStyleRef.current(styleRef.current);

      // ── Drag rotation ───────────────────────────────────────────────────
      let rotY = 0.4, rotX = 0.2, dragging = false, lx = 0, ly = 0;
      const onDown = (e: PointerEvent) => { dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); };
      const onUp   = () => { dragging = false; };
      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        rotY += (e.clientX - lx) * 0.01; lx = e.clientX;
        rotX += (e.clientY - ly) * 0.01; ly = e.clientY;
        rotX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, rotX));
      };
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointerup',   onUp);
      canvas.addEventListener('pointermove', onMove);

      // ── Resize ──────────────────────────────────────────────────────────
      const ro = new ResizeObserver(() => {
        const cw = canvas.clientWidth, ch = canvas.clientHeight;
        if (!cw || !ch) return;
        renderer.setSize(cw, ch, false);
        camera.aspect = cw / ch;
        camera.updateProjectionMatrix();
      });
      ro.observe(canvas);

      // ── Animation loop ───────────────────────────────────────────────────
      let raf = 0;
      const tick = () => {
        raf = requestAnimationFrame(tick);

        // Orbit
        if (!dragging) rotY += 0.005;
        group.rotation.y = rotY;
        group.rotation.x = rotX;

        // Gear counter-rotation (ratio always current via ref)
        const { z1, z2 } = ratioRef.current;
        spinRef.current.s2 += OMEGA;
        spinRef.current.s1 -= OMEGA * (z2 / z1);
        pivot1.rotation.y = spinRef.current.s1;
        pivot2.rotation.y = spinRef.current.s2;

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
        applyStyleRef.current = null;
      };
    })();

    return () => { cancelled = true; dispose(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Rebuild gears when design parameters change ───────────────────────────
  useEffect(() => {
    const THREE = threeRef.current;
    if (!THREE) return; // initial load handles it
    rebuildGears(THREE);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g1.teeth, g2.teeth, g1.boreDiameterMm, g2.boreDiameterMm, moduleMm, pa]);

  // ── Sync style state → renderer (instant, no rebuild) ────────────────────
  useEffect(() => {
    styleRef.current = style;
    applyStyleRef.current?.(style);
  }, [style]);

  return (
    <div className="gear3d-wrap">
      <canvas ref={canvasRef} className="gear3d-canvas" />
      <button
        className="gear3d-style-btn"
        onClick={() => setStyle(s => s === 'blueprint' ? 'wireframe' : 'blueprint')}
        title="Toggle visual style"
      >
        {style === 'blueprint' ? '◻ Blueprint' : '◼ Wireframe'}
      </button>
    </div>
  );
}
