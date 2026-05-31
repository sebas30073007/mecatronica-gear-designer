import { useEffect, useRef, useState } from 'react';
import type * as T3 from 'three';
import type { WormParams } from '../../core/gearTypes';
import { generateSpurGearOutline } from '../../geometry/spurGear2D';

type TM = typeof T3;

const DEBOUNCE_MS = 900;
const RED     = 0xc8202a;
const GRID    = 0xf2c8cc;
const OMEGA   = 0.005;
const DEG2RAD = Math.PI / 180;
const ISO_FOV = 34;
const Q       = 8;   // worm diameter quotient: d_worm = Q * module (lower = steeper lead angle)

// Parametric worm surface: trapezoidal thread profile wound helically.
// phase = v*starts - x*2π/lead maps every (angle, axial) point to a position in the tooth cycle.
// Returns [threadSurface, leftShaftStub, rightShaftStub].
function buildWormGeos(THREE: TM, starts: number, moduleMm: number, length: number): T3.BufferGeometry[] {
  const pitchR = Q * moduleMm / 2;
  const outerR = pitchR + moduleMm;                           // addendum circle
  const rootR  = Math.max(pitchR - 1.25 * moduleMm, moduleMm * 0.4);  // dedendum circle
  const p_a    = Math.PI * moduleMm;                          // axial pitch (distance between adjacent crests axially)

  const uSegs = 128;                           // along worm axis (X)
  const vSegs = Math.max(72, starts * 48);     // around circumference

  // Trapezoidal profile: TIPF = half-crest fraction, FLNF = where linear flank meets root
  const TIPF = 0.13, FLNF = 0.25;  // 26% crest, 50% total tooth width at pitch line
  function rAt(phase: number): number {
    const t  = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const dt = Math.min(t, Math.PI * 2 - t) / (Math.PI * 2); // symmetric [0, 0.5]
    if (dt <= TIPF) return outerR;                             // flat crest (tip)
    if (dt >= FLNF) return rootR;                              // flat root
    return outerR + (rootR - outerR) * (dt - TIPF) / (FLNF - TIPF); // linear flank
  }

  const pos: number[] = [];
  const idx: number[] = [];

  for (let ui = 0; ui <= uSegs; ui++) {
    const x = (ui / uSegs - 0.5) * length;
    for (let vi = 0; vi <= vSegs; vi++) {
      const v = (vi / vSegs) * Math.PI * 2;
      const r = rAt(v * starts - x * Math.PI * 2 / p_a);
      pos.push(x, Math.cos(v) * r, Math.sin(v) * r);
    }
  }
  for (let ui = 0; ui < uSegs; ui++) {
    for (let vi = 0; vi < vSegs; vi++) {
      const a = ui * (vSegs + 1) + vi;
      const c = (ui + 1) * (vSegs + 1) + vi;
      idx.push(a, c, c + 1,  a, c + 1, a + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  // Short stub shafts extending beyond the thread region
  const extLen = moduleMm * 4;
  const mkStub = (xCenter: number) => {
    const g = new THREE.CylinderGeometry(rootR, rootR, extLen, 32, 1);
    g.rotateZ(Math.PI / 2);
    g.translate(xCenter, 0, 0);
    return g;
  };

  return [geo, mkStub(-(length / 2 + extLen / 2)), mkStub(length / 2 + extLen / 2)];
}

// Worm wheel: involute spur gear profile + helical twist (angle = worm lead angle)
function buildWheelGeo(
  THREE: TM, wheelTeeth: number, moduleMm: number, pa: number,
  thickness: number, leadAngleDeg: number
): T3.BufferGeometry {
  const prof  = generateSpurGearOutline({ teeth: wheelTeeth, moduleMm, pressureAngleDeg: pa });
  const shape = new THREE.Shape();
  prof.outline.forEach((p, i) => i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y));
  shape.closePath();

  const boreR = Math.max(prof.rootRadius * 0.28, moduleMm);
  const hole  = new THREE.Path();
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    i === 0 ? hole.moveTo(Math.cos(a) * boreR, Math.sin(a) * boreR)
            : hole.lineTo(Math.cos(a) * boreR, Math.sin(a) * boreR);
  }
  shape.holes.push(hole);

  const depth = Math.max(thickness, 5);
  const geo   = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 20, curveSegments: 1 });

  const pitchR     = (wheelTeeth * moduleMm) / 2;
  const totalTwist = (depth * Math.tan(leadAngleDeg * DEG2RAD)) / pitchR;
  const pos        = geo.attributes.position as T3.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const angle = (z / depth - 0.5) * totalTwist;
    const x = pos.getX(i), y = pos.getY(i);
    pos.setXY(i, x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.center();
  return geo;
}

export default function WormGearCanvas3D({ starts, wheelTeeth, moduleMm, pressureAngleDeg, thicknessMm }: WormParams) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const threeRef    = useRef<TM | null>(null);
  const cameraRef   = useRef<T3.PerspectiveCamera | null>(null);
  const groupRef    = useRef<T3.Group | null>(null);
  const wormPivRef  = useRef<T3.Group | null>(null);
  const wheelPivRef = useRef<T3.Group | null>(null);
  const oldGeoRef   = useRef<(() => void) | null>(null);
  const boundRef    = useRef(3.5);
  const spinRef     = useRef({ worm: 0, wheel: 0 });
  const ratioRef    = useRef({ z: wheelTeeth, s: starts });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomRef     = useRef(1.0);
  const [isLoading, setIsLoading] = useState(false);

  function rebuildGears(THREE: TM) {
    const wormPiv = wormPivRef.current, wheelPiv = wheelPivRef.current;
    const group   = groupRef.current;
    if (!wormPiv || !wheelPiv || !group) return;

    const rWorm  = Q * moduleMm / 2;
    const rWheel = (wheelTeeth * moduleMm) / 2;
    const cd     = rWorm + rWheel;
    const leadAngle = Math.atan(starts / Q) / DEG2RAD;
    // Ensure at least 4 axial pitches are visible regardless of starts count
    const threadLen = Math.max(thicknessMm, 4 * Math.PI * moduleMm);

    const SC = 3.5 / rWheel;
    boundRef.current = (cd / 2 + (wheelTeeth + 2) * moduleMm / 2) * SC * 1.05;

    wormPiv.position.set(0,  cd / 2, 0);
    wheelPiv.position.set(0, -cd / 2, 0);
    [wormPiv, wheelPiv].forEach(p => { while (p.children.length) p.remove(p.children[0]!); });

    const wormGeos   = buildWormGeos(THREE, starts, moduleMm, threadLen);
    const wheelGeo   = buildWheelGeo(THREE, wheelTeeth, moduleMm, pressureAngleDeg, thicknessMm, leadAngle);
    const wheelEdges = new THREE.EdgesGeometry(wheelGeo, 12);

    const mkFill = (g: T3.BufferGeometry) => new THREE.Mesh(g,
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
    const mkLine = (g: T3.BufferGeometry) =>
      new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: RED }));

    wheelPiv.add(mkFill(wheelGeo), mkLine(wheelEdges));

    const disposables: T3.BufferGeometry[] = [wheelGeo, wheelEdges, ...wormGeos];
    for (const wg of wormGeos) {
      const we = new THREE.EdgesGeometry(wg, 20);
      disposables.push(we);
      wormPiv.add(mkFill(wg), mkLine(we));
    }

    oldGeoRef.current?.();
    oldGeoRef.current = () => disposables.forEach(g => g.dispose());

    group.scale.setScalar(SC);
    ratioRef.current = { z: wheelTeeth, s: starts };
    // Phase-sync: at worm rotation=0 the thread phase at the contact point (v=π) = π*starts.
    // Even starts → crest there → offset wheel by half tooth-pitch to put wheel gap at contact.
    // Odd starts  → root there  → leave wheel at 0 so wheel tooth sits in the worm root.
    spinRef.current  = { worm: 0, wheel: starts % 2 === 0 ? Math.PI / wheelTeeth : 0 };
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

      const wormPiv  = new THREE.Group(); wormPivRef.current  = wormPiv;
      const wheelPiv = new THREE.Group(); wheelPivRef.current = wheelPiv;
      group.add(wormPiv, wheelPiv);

      const grid = new THREE.GridHelper(80, 40, GRID, GRID);
      (grid.material as T3.Material).transparent = true;
      (grid.material as T3.Material).opacity = 0.5;
      scene.add(grid);

      rebuildGears(THREE);

      let rotY = 0.75, rotX = 0.28, dragging = false, lx = 0, ly = 0;
      const onDown = (e: PointerEvent) => { dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); };
      const onUp   = () => { dragging = false; };
      const onMove = (e: PointerEvent) => {
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
      canvas.addEventListener('wheel', onWheel, { passive: false });
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
        const sb      = boundRef.current;
        const camDist = sb / Math.tan((ISO_FOV / 2) * DEG2RAD) * 1.44;
        const zoom = zoomRef.current;
        camera.position.set(0, camDist * 0.82 * zoom, camDist * 0.68 * zoom);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();

        group.rotation.y = rotY;
        group.rotation.x = rotX;
        grid.position.y  = -sb * 1.2;

        const { z, s } = ratioRef.current;
        spinRef.current.worm  += OMEGA;
        spinRef.current.wheel += OMEGA * s / z;
        wormPiv.rotation.x  = spinRef.current.worm;
        wheelPiv.rotation.z = spinRef.current.wheel;

        renderer.render(scene, camera);
      };
      tick();

      dispose = () => {
        canvas.removeEventListener('wheel', onWheel);
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointerup',   onUp);
        canvas.removeEventListener('pointermove', onMove);
        ro.disconnect();
        cancelAnimationFrame(raf);
        oldGeoRef.current?.();
        renderer.dispose();
        threeRef.current = cameraRef.current = groupRef.current = null;
        wormPivRef.current = wheelPivRef.current = null;
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
  }, [starts, wheelTeeth, moduleMm, pressureAngleDeg, thicknessMm]);

  return (
    <div className="gear3d-wrap">
      <canvas ref={canvasRef} className="gear3d-canvas" />
      {isLoading && <div className="gear3d-loading"><div className="gear3d-spinner" /></div>}
    </div>
  );
}
