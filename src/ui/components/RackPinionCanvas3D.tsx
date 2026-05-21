import { useEffect, useRef } from 'react';
import type * as T3 from 'three';
import type { RackPinionParams } from '../../core/gearTypes';
import { generateSpurGearOutline } from '../../geometry/spurGear2D';

type TM = typeof T3;
const RED = 0xc8202a, GRID = 0xf2c8cc, OMEGA = 0.007;

function makeRackShape(THREE: TM, lengthMm: number, moduleMm: number, pa = 20) {
  const pitch   = Math.PI * moduleMm;
  const add     = moduleMm;
  const ded     = 1.25 * moduleMm;
  const baseH   = ded + add * 2.5;
  const tan     = Math.tan(pa * Math.PI / 180);
  const halfTip = pitch / 4 - add * tan;
  const halfDed = pitch / 4 + ded * tan;
  const nT      = Math.floor(lengthMm / pitch);
  const L2      = (nT * pitch) / 2;

  const shape = new THREE.Shape();
  shape.moveTo(-L2, -baseH);
  shape.lineTo( L2, -baseH);
  shape.lineTo( L2, -ded);

  for (let i = nT - 1; i >= 0; i--) {
    const tc = -L2 + (i + 0.5) * pitch;
    shape.lineTo(tc + halfDed, -ded);
    if (halfTip > 0) {
      shape.lineTo(tc + halfTip, add);
      shape.lineTo(tc - halfTip, add);
    } else {
      shape.lineTo(tc, add);
    }
    shape.lineTo(tc - halfDed, -ded);
  }

  shape.lineTo(-L2, -ded);
  shape.closePath();
  return shape;
}

function makeGearGeo(THREE: TM, teeth: number, moduleMm: number, pa: number, thick: number, R1_mm: number) {
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
  geo.center(); // stays in XY plane, extruded along Z — rotates around Z axis
  return geo;
}

export default function RackPinionCanvas3D({ pinionTeeth, moduleMm, pressureAngleDeg, rackLengthMm, thicknessMm }: RackPinionParams) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const disposeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    (async () => {
      const THREE = await import('three');
      if (cancelled) return;

      const R1_mm = (pinionTeeth * moduleMm) / 2;
      const SC    = 3.5 / R1_mm;
      const w = canvas.clientWidth || 900, h = canvas.clientHeight || 550;

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0xffffff, 1);

      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 5000);

      // Camera framed on the pinion — rack extends beyond, that's intentional
      const outerR_mm  = (pinionTeeth + 2) * moduleMm / 2;
      const rackH_mm   = 1.25 * moduleMm + moduleMm + moduleMm * 2.5; // dedendum + add + base
      const sceneBound = Math.max(outerR_mm, rackH_mm) * SC * 1.6;
      const camDist    = (sceneBound / Math.sin((35 / 2) * Math.PI / 180)) * 1.3;
      camera.position.copy(new THREE.Vector3(7, 8, 11).normalize().multiplyScalar(camDist));
      camera.lookAt(0, -R1_mm * SC * 0.4, 0); // look slightly below center to show rack

      // Group
      const group = new THREE.Group();
      group.scale.setScalar(SC);
      group.rotation.y = 0.5;
      group.rotation.x = 0.25;
      scene.add(group);

      // Pinion pivot (rotates around Y)
      const pinPivot = new THREE.Group();
      group.add(pinPivot);

      // Rack pivot (translates along X)
      const rackGroup = new THREE.Group();
      rackGroup.position.y = -R1_mm;
      group.add(rackGroup);

      // Gear geometry
      const geoPin = makeGearGeo(THREE, pinionTeeth, moduleMm, pressureAngleDeg, thicknessMm, R1_mm);
      const rackShape = makeRackShape(THREE, rackLengthMm, moduleMm, pressureAngleDeg);
      const geoRack = new THREE.ExtrudeGeometry(rackShape, { depth: thicknessMm, bevelEnabled: false, curveSegments: 1 });
      geoRack.translate(0, 0, -thicknessMm / 2);

      const fillMat = (geo: T3.BufferGeometry) => {
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
          color: 0xffffff, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
        }));
        m.visible = true;
        return m;
      };
      const edgeMat = (geo: T3.BufferGeometry) =>
        new THREE.LineSegments(new THREE.EdgesGeometry(geo as T3.BufferGeometry, 12), new THREE.LineBasicMaterial({ color: RED }));

      pinPivot.add(fillMat(geoPin), edgeMat(geoPin));
      rackGroup.add(fillMat(geoRack), edgeMat(geoRack));

      // Grid — sits below the rack base
      const ded_mm = 1.25 * moduleMm;
      const baseH_mm = ded_mm + moduleMm * 2.5;
      const grid = new THREE.GridHelper(sceneBound * 10, 40, GRID, GRID);
      grid.position.y = -(R1_mm + baseH_mm) * SC * 1.05;
      (grid.material as T3.Material).transparent = true;
      (grid.material as T3.Material).opacity = 0.6;
      scene.add(grid);

      // Drag
      let rotY = 0.5, rotX = 0.25, dragging = false, lx = 0, ly = 0;
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

      // Initial phase: gap at -Y (toward rack) for any tooth count
      const pitchA = (2 * Math.PI) / pinionTeeth;
      const kInit  = Math.round((3 * Math.PI / 2) / pitchA - 0.5);
      const phaseZ = (3 * Math.PI / 2) - (kInit + 0.5) * pitchA;

      const maxTravel = rackLengthMm / 2 - R1_mm;
      let raf = 0, spin = 0;
      const tick = () => {
        raf = requestAnimationFrame(tick);
        if (!dragging) rotY += 0.005;
        group.rotation.y = rotY;
        group.rotation.x = rotX;
        spin += OMEGA;
        const travel = Math.sin(spin * 0.4) * maxTravel;
        rackGroup.position.x = travel;
        pinPivot.rotation.z = phaseZ - travel / R1_mm;
        renderer.render(scene, camera);
      };
      tick();

      disposeRef.current = () => {
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointerup',   onUp);
        canvas.removeEventListener('pointermove', onMove);
        ro.disconnect();
        cancelAnimationFrame(raf);
        geoPin.dispose(); geoRack.dispose();
        renderer.dispose();
      };
    })();

    return () => { cancelled = true; disposeRef.current?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinionTeeth, moduleMm, pressureAngleDeg, rackLengthMm, thicknessMm]);

  return <div className="gear3d-wrap"><canvas ref={canvasRef} className="gear3d-canvas" /></div>;
}
