import { useEffect, useRef } from 'react';
import type * as T3 from 'three';
import type { HelicalParams } from '../../core/gearTypes';
import { generateSpurGearOutline } from '../../geometry/spurGear2D';

type TM = typeof T3;

const RED     = 0xc8202a;
const GRID    = 0xf2c8cc;
const OMEGA   = 0.006;
const DEG2RAD = Math.PI / 180;
const ISO_FOV = 34;
const ISO_LEN = Math.sqrt(1.02 * 1.02 + 0.82 * 0.82);
const ISO_Y   = 1.02 / ISO_LEN;
const ISO_Z   = 0.82 / ISO_LEN;

// Build one helical half (centered at z=0, spans [-depth/2, +depth/2]).
// Identical pattern to HelicalGearCanvas3D — proven stable in Three.js r184.
function buildHalf(
  THREE: TM, teeth: number, moduleMm: number, pa: number,
  depth: number, helixSign: number, helixAngleDeg: number
): T3.BufferGeometry {
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
    depth, bevelEnabled: false, steps: 28, curveSegments: 1,
  });

  const pitchR     = (teeth * moduleMm) / 2;
  const totalTwist = helixSign * (depth * Math.tan(helixAngleDeg * DEG2RAD)) / pitchR;
  const pos        = geo.attributes.position as T3.BufferAttribute;

  for (let i = 0; i < pos.count; i++) {
    const z     = pos.getZ(i);                    // [0, depth] before center()
    const angle = (z / depth - 0.5) * totalTwist; // symmetric: 0 at mid-plane
    const x = pos.getX(i), y = pos.getY(i);
    pos.setXY(i,
      x * Math.cos(angle) - y * Math.sin(angle),
      x * Math.sin(angle) + y * Math.cos(angle)
    );
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.center(); // now spans z ∈ [−depth/2, +depth/2]
  return geo;
}

// Add a complete herringbone gear (Λ shape) to a pivot.
// Bottom half = helixSign, top half = −helixSign, meeting at z=0 with matching twist.
// Returns a dispose function.
function attachHerringbone(
  THREE: TM, pivot: T3.Group,
  teeth: number, moduleMm: number, pa: number,
  thicknessMm: number, helixSign: number, helixAngleDeg: number
): () => void {
  const half = Math.max(thicknessMm, 5) / 2;

  const gBot = buildHalf(THREE, teeth, moduleMm, pa, half, +helixSign, helixAngleDeg);
  const gTop = buildHalf(THREE, teeth, moduleMm, pa, half, -helixSign, helixAngleDeg);
  const eBot = new THREE.EdgesGeometry(gBot, 12);
  const eTop = new THREE.EdgesGeometry(gTop, 12);

  const mkFill = (g: T3.BufferGeometry) => new THREE.Mesh(g,
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  const mkLine = (g: T3.BufferGeometry) =>
    new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: RED }));

  // gBot centered → spans [−half/2, +half/2]
  // Shift to [−half, 0]: position.z = −half/2
  const mBot = mkFill(gBot); mBot.position.z = -half / 2;
  const lBot = mkLine(eBot); lBot.position.z = -half / 2;

  // gTop centered → spans [−half/2, +half/2]
  // Shift to [0, +half]: position.z = +half/2
  const mTop = mkFill(gTop); mTop.position.z = +half / 2;
  const lTop = mkLine(eTop); lTop.position.z = +half / 2;

  pivot.add(mBot, lBot, mTop, lTop);
  return () => { gBot.dispose(); gTop.dispose(); eBot.dispose(); eTop.dispose(); };
}

export default function HerringboneGearCanvas3D({
  outputTeeth, inputTeeth, moduleMm, pressureAngleDeg, helixAngleDeg, thicknessMm,
}: HelicalParams) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const threeRef  = useRef<TM | null>(null);
  const cameraRef = useRef<T3.PerspectiveCamera | null>(null);
  const groupRef  = useRef<T3.Group | null>(null);
  const pivot1Ref = useRef<T3.Group | null>(null);
  const pivot2Ref = useRef<T3.Group | null>(null);
  const oldGeoRef = useRef<(() => void) | null>(null);
  const scRef     = useRef(1);
  const boundRef  = useRef(3.5);
  const ratioRef  = useRef({ z1: outputTeeth, z2: inputTeeth });
  const spinRef   = useRef({ s1: 0, s2: 0 });

  function rebuildGears(THREE: TM) {
    const pivot1 = pivot1Ref.current, pivot2 = pivot2Ref.current;
    const group  = groupRef.current;
    if (!pivot1 || !pivot2 || !group) return;

    const R1_mm    = (outputTeeth * moduleMm) / 2;
    const SC       = 3.5 / R1_mm;
    const cd       = (outputTeeth + inputTeeth) * moduleMm / 2;
    const R1_outer = (outputTeeth + 2) * moduleMm / 2;

    scRef.current    = SC;
    boundRef.current = (cd / 2 + R1_outer) * SC * 1.1;
    pivot1.position.x = -cd / 2;
    pivot2.position.x =  cd / 2;

    [pivot1, pivot2].forEach(p => { while (p.children.length) p.remove(p.children[0]!); });

    const d1 = attachHerringbone(THREE, pivot1, outputTeeth, moduleMm, pressureAngleDeg, thicknessMm, +1, helixAngleDeg);
    const d2 = attachHerringbone(THREE, pivot2, inputTeeth,  moduleMm, pressureAngleDeg, thicknessMm, -1, helixAngleDeg);

    oldGeoRef.current?.();
    oldGeoRef.current = () => { d1(); d2(); };

    group.scale.setScalar(SC);
    spinRef.current = { s1: 0, s2: (inputTeeth - 1) * Math.PI / inputTeeth };
    ratioRef.current = { z1: outputTeeth, z2: inputTeeth };
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
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
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

      const grid = new THREE.GridHelper(80, 40, GRID, GRID);
      (grid.material as T3.Material).transparent = true;
      (grid.material as T3.Material).opacity = 0.5;
      scene.add(grid);

      rebuildGears(THREE);

      let rotY = 0.38, rotX = 0.22, dragging = false, lx = 0, ly = 0;

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

      let raf = 0;
      const tick = () => {
        raf = requestAnimationFrame(tick);

        const sb      = boundRef.current;
        const camDist = sb / Math.tan((ISO_FOV / 2) * DEG2RAD) * 1.44;
        camera.position.set(0, ISO_Y * camDist, ISO_Z * camDist);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();

        group.rotation.y = rotY;
        group.rotation.x = rotX;
        grid.position.y  = -sb * 1.1;

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

  useEffect(() => {
    const THREE = threeRef.current;
    if (!THREE) return;
    rebuildGears(THREE);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputTeeth, inputTeeth, moduleMm, pressureAngleDeg, helixAngleDeg, thicknessMm]);

  return <div className="gear3d-wrap"><canvas ref={canvasRef} className="gear3d-canvas" /></div>;
}
