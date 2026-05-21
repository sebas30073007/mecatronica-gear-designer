import { useEffect, useRef } from 'react';
import type * as T3 from 'three';
import type { InternalGearParams } from '../../core/gearTypes';
import { generateSpurGearOutline } from '../../geometry/spurGear2D';

type TM = typeof T3;
const RED = 0xc8202a, GRID = 0xf2c8cc, OMEGA = 0.007;

function makeSpurGeo(THREE: TM, teeth: number, moduleMm: number, pa: number, thick: number, R1_mm: number) {
  const prof  = generateSpurGearOutline({ teeth, moduleMm, pressureAngleDeg: pa });
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
    depth: Math.max(thick, R1_mm * 0.4), bevelEnabled: false, curveSegments: 12,
  });
  geo.center();
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function makeRingGeo(THREE: TM, ringTeeth: number, moduleMm: number, pa: number, thick: number, wallMm: number) {
  const prof   = generateSpurGearOutline({ teeth: ringTeeth, moduleMm, pressureAngleDeg: pa });
  const outerR = prof.outerRadius + wallMm + moduleMm;

  const shape = new THREE.Shape();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    if (i === 0) shape.moveTo(Math.cos(a) * outerR, Math.sin(a) * outerR);
    else         shape.lineTo(Math.cos(a) * outerR, Math.sin(a) * outerR);
  }

  const hole = new THREE.Path();
  prof.outline.forEach((p, i) => {
    if (i === 0) hole.moveTo(p.x, p.y);
    else         hole.lineTo(p.x, p.y);
  });
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(thick, 8), bevelEnabled: false, curveSegments: 4 });
  geo.center();
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function makeEdges(THREE: TM, geo: T3.BufferGeometry) {
  return new THREE.LineSegments(new THREE.EdgesGeometry(geo as T3.BufferGeometry, 12), new THREE.LineBasicMaterial({ color: RED }));
}
function makeFill(THREE: TM, geo: T3.BufferGeometry) {
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0xffffff, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  }));
}

export default function InternalGearCanvas3D({ ringTeeth, pinionTeeth, moduleMm, pressureAngleDeg, wallThicknessMm, thicknessMm }: InternalGearParams) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const disposeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    (async () => {
      const THREE = await import('three');
      if (cancelled) return;

      const R_ring = (ringTeeth * moduleMm) / 2;
      const R_pin  = (pinionTeeth * moduleMm) / 2;
      const cd     = R_ring - R_pin;           // internal gear center distance
      const outerR = R_ring + wallThicknessMm + moduleMm;
      const ratio  = ringTeeth / pinionTeeth;

      const SC = 3.0 / outerR;
      const w = canvas.clientWidth || 900, h = canvas.clientHeight || 550;

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0xffffff, 1);

      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 5000);
      const sceneBound = outerR * SC;
      const camDist = (sceneBound / Math.sin((35 / 2) * Math.PI / 180)) * 1.4;
      camera.position.copy(new THREE.Vector3(9, 6.5, 11).normalize().multiplyScalar(camDist));
      camera.lookAt(0, 0, 0);

      const group = new THREE.Group();
      group.scale.setScalar(SC);
      group.rotation.y = 0.4;
      group.rotation.x = 0.2;
      scene.add(group);

      // Ring pivot (centered at origin)
      const ringPivot = new THREE.Group();
      group.add(ringPivot);

      // Pinion pivot (offset by center distance)
      const pinPivot = new THREE.Group();
      pinPivot.position.x = cd;
      group.add(pinPivot);

      const geoRing = makeRingGeo(THREE, ringTeeth, moduleMm, pressureAngleDeg, thicknessMm, wallThicknessMm);
      const geoPin  = makeSpurGeo(THREE, pinionTeeth, moduleMm, pressureAngleDeg, thicknessMm, R_ring);

      ringPivot.add(makeFill(THREE, geoRing), makeEdges(THREE, geoRing));
      pinPivot.add(makeFill(THREE, geoPin),   makeEdges(THREE, geoPin));

      // Grid
      const grid = new THREE.GridHelper(outerR * 5, 30, GRID, GRID);
      grid.position.y = -(outerR * SC * 1.2);
      (grid.material as T3.Material).transparent = true;
      (grid.material as T3.Material).opacity = 0.6;
      scene.add(grid);

      // initPin = 0: tooth 0 at +X aligns with ring notch at +X (contact point)
      // Works for both even and odd tooth counts (odd formula placed gap at contact, not tooth)
      const initPin = 0;
      pinPivot.rotation.y = initPin;

      // Drag
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

      const ro = new ResizeObserver(() => {
        const cw = canvas.clientWidth, ch = canvas.clientHeight;
        if (!cw || !ch) return;
        renderer.setSize(cw, ch, false);
        camera.aspect = cw / ch;
        camera.updateProjectionMatrix();
      });
      ro.observe(canvas);

      let raf = 0, spinPin = 0, spinRing = 0;
      const tick = () => {
        raf = requestAnimationFrame(tick);
        if (!dragging) rotY += 0.005;
        group.rotation.y = rotY;
        group.rotation.x = rotX;
        // Both same direction; ring slower by ratio
        spinPin  += OMEGA;
        spinRing += OMEGA / ratio;
        pinPivot.rotation.y  = spinPin;
        ringPivot.rotation.y = spinRing;
        renderer.render(scene, camera);
      };
      tick();

      disposeRef.current = () => {
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointerup',   onUp);
        canvas.removeEventListener('pointermove', onMove);
        ro.disconnect();
        cancelAnimationFrame(raf);
        geoRing.dispose(); geoPin.dispose();
        renderer.dispose();
      };
    })();

    return () => { cancelled = true; disposeRef.current?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ringTeeth, pinionTeeth, moduleMm, pressureAngleDeg, wallThicknessMm, thicknessMm]);

  return <div className="gear3d-wrap"><canvas ref={canvasRef} className="gear3d-canvas" /></div>;
}
