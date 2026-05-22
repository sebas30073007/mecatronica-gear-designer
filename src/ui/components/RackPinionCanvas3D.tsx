import { useEffect, useRef } from 'react';
import type * as T3 from 'three';
import type { RackPinionParams, ViewMode } from '../../core/gearTypes';
import { generateSpurGearOutline } from '../../geometry/spurGear2D';

type TM = typeof T3;
const RED = 0xc8202a, GRID = 0xf2c8cc, OMEGA = 0.007;

const FRONT_FOV = 18, ISO_FOV = 34;
const DEG2RAD   = Math.PI / 180;
const ISO_LEN   = Math.sqrt(1.02 * 1.02 + 0.82 * 0.82);
const ISO_Y     = 1.02 / ISO_LEN, ISO_Z = 0.82 / ISO_LEN;
const lerp      = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => t * t * (3 - 2 * t);
const wrapAngle = (a: number) => { const r = ((a % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI); return r > Math.PI ? r - 2*Math.PI : r; };

function makeRackShape(THREE: TM, lengthMm: number, moduleMm: number, pa = 20) {
  const pitch = Math.PI * moduleMm, add = moduleMm, ded = 1.25 * moduleMm;
  const tan   = Math.tan(pa * Math.PI / 180);
  const halfTip = pitch / 4 - add * tan, halfDed = pitch / 4 + ded * tan;
  const nT  = Math.floor(lengthMm / pitch), L2 = (nT * pitch) / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-L2, -(ded + add * 2.5));
  shape.lineTo( L2, -(ded + add * 2.5));
  shape.lineTo( L2, -ded);
  for (let i = nT - 1; i >= 0; i--) {
    const tc = -L2 + (i + 0.5) * pitch;
    shape.lineTo(tc + halfDed, -ded);
    if (halfTip > 0) { shape.lineTo(tc + halfTip, add); shape.lineTo(tc - halfTip, add); }
    else { shape.lineTo(tc, add); }
    shape.lineTo(tc - halfDed, -ded);
  }
  shape.lineTo(-L2, -ded);
  shape.closePath();
  return shape;
}

// Gear in XY plane, extrudes along Z, rotates on Z
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
  const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(thick, R1_mm * 0.4), bevelEnabled: false, curveSegments: 12 });
  geo.center();
  return geo;
}

interface Props extends RackPinionParams { viewMode: ViewMode; }

export default function RackPinionCanvas3D({ pinionTeeth, moduleMm, pressureAngleDeg, rackLengthMm, thicknessMm, viewMode }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const disposeRef = useRef<(() => void) | null>(null);
  const targetRef  = useRef(viewMode === '3d' ? 1 : 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    (async () => {
      const THREE = await import('three');
      if (cancelled) return;

      const R1_mm  = (pinionTeeth * moduleMm) / 2;
      const SC     = 3.5 / R1_mm;
      const outerR_mm  = (pinionTeeth + 2) * moduleMm / 2;
      const rackH_mm   = 1.25 * moduleMm + moduleMm + moduleMm * 2.5;
      const sceneBound = Math.max(outerR_mm, rackH_mm) * SC * 1.6;
      const centerY    = -R1_mm * SC * 0.3;   // look-at y: between pinion and rack

      const w = canvas.clientWidth || 900, h = canvas.clientHeight || 550;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0xffffff, 1);

      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(ISO_FOV, w / h, 0.1, 5000);

      const group = new THREE.Group();
      group.scale.setScalar(SC);
      scene.add(group);

      const pinPivot  = new THREE.Group();
      group.add(pinPivot);
      const rackGroup = new THREE.Group();
      rackGroup.position.y = -R1_mm;
      group.add(rackGroup);

      const geoPin  = makeGearGeo(THREE, pinionTeeth, moduleMm, pressureAngleDeg, thicknessMm, R1_mm);
      const rackShape = makeRackShape(THREE, rackLengthMm, moduleMm, pressureAngleDeg);
      const geoRack = new THREE.ExtrudeGeometry(rackShape, { depth: thicknessMm, bevelEnabled: false, curveSegments: 1 });
      geoRack.translate(0, 0, -thicknessMm / 2);

      const fillMat = (geo: T3.BufferGeometry) =>
        new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
      const edgeMat = (geo: T3.BufferGeometry) =>
        new THREE.LineSegments(new THREE.EdgesGeometry(geo as T3.BufferGeometry, 12), new THREE.LineBasicMaterial({ color: RED }));

      pinPivot.add(fillMat(geoPin), edgeMat(geoPin));
      rackGroup.add(fillMat(geoRack), edgeMat(geoRack));

      const grid = new THREE.GridHelper(80, 40, GRID, GRID);
      (grid.material as T3.Material).transparent = true;
      (grid.material as T3.Material).opacity = 0.3;
      scene.add(grid);

      // Pinion initial phase: gap at -Y (toward rack)
      const pitchA = (2 * Math.PI) / pinionTeeth;
      const kInit  = Math.round((3 * Math.PI / 2) / pitchA - 0.5);
      const phaseZ = (3 * Math.PI / 2) - (kInit + 0.5) * pitchA;

      let progress   = targetRef.current;
      let prevTarget = targetRef.current;
      let rotY = viewMode === '3d' ? 0.5 : 0;
      let rotX = viewMode === '3d' ? 0.2 : 0;
      let dragging = false, lx = 0, ly = 0;

      const onDown = (e: PointerEvent) => { dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); };
      const onUp   = () => { dragging = false; };
      const onMove = (e: PointerEvent) => {
        if (!dragging || targetRef.current < 0.5) return;
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

      const maxTravel = rackLengthMm / 2 - R1_mm;
      let raf = 0, spin = 0;

      const tick = () => {
        raf = requestAnimationFrame(tick);

        const curTarget = targetRef.current;
        if (curTarget !== prevTarget) {
          if (curTarget < 0.5 && prevTarget >= 0.5) {
            rotY = wrapAngle(rotY);
            rotX = Math.max(-0.5, Math.min(0.5, rotX));
          }
          prevTarget = curTarget;
        }

        progress += (curTarget - progress) * 0.055;
        const p = easeInOut(Math.max(0, Math.min(1, progress)));

        // Camera lerp — lookAt slightly below center to show rack in both views
        const fd = sceneBound / Math.tan((FRONT_FOV / 2) * DEG2RAD) * 1.1;
        const id = sceneBound / Math.tan((ISO_FOV  / 2) * DEG2RAD) * 1.44;
        camera.position.set(0, lerp(0, ISO_Y * id, p), lerp(fd, ISO_Z * id, p));
        camera.fov = lerp(FRONT_FOV, ISO_FOV, p);
        camera.lookAt(0, centerY, 0);
        camera.updateProjectionMatrix();

        // Scale z
        group.scale.z = SC * lerp(0.003, 1.0, p);

        // Orbital — no auto-spin; decay in 2D
        if (!dragging && curTarget < 0.5) { rotY *= 0.92; rotX *= 0.92; }
        group.rotation.y = rotY;
        group.rotation.x = rotX;

        // Grid
        grid.rotation.x = lerp(Math.PI / 2, 0, p);
        grid.position.y = lerp(centerY - sceneBound * 0.3, -(R1_mm + 1.25 * moduleMm + moduleMm * 2.5) * SC * 1.1, p);
        grid.position.z = lerp(-sceneBound * 0.5, 0, p);
        (grid.material as T3.Material).opacity = lerp(0.3, 0.55, p);

        // Rack + pinion
        spin += OMEGA;
        const travel = Math.sin(spin * 0.4) * maxTravel;
        rackGroup.position.x = travel;
        // rack right → pinion CCW (+z): opposite sign from naive guess
        pinPivot.rotation.z  = phaseZ + travel / R1_mm;

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

  useEffect(() => { targetRef.current = viewMode === '3d' ? 1 : 0; }, [viewMode]);

  return <div className="gear3d-wrap"><canvas ref={canvasRef} className="gear3d-canvas" /></div>;
}
