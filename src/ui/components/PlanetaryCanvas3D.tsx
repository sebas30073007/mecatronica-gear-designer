import { useEffect, useRef } from 'react';
import type * as T3 from 'three';
import type { PlanetaryParams, ViewMode } from '../../core/gearTypes';
import { planetaryRingTeeth } from '../../core/gearTypes';
import { generateSpurGearOutline } from '../../geometry/spurGear2D';

type TM = typeof T3;
const RED  = 0xc8202a, GRID = 0xf2c8cc, OMEGA = 0.006;

const FRONT_FOV = 18, ISO_FOV = 34, DEG2RAD = Math.PI / 180;
const ISO_LEN = Math.sqrt(1.02 * 1.02 + 0.82 * 0.82);
const ISO_Y = 1.02 / ISO_LEN, ISO_Z = 0.82 / ISO_LEN;
const lerp      = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => t * t * (3 - 2 * t);
const wrapAngle = (a: number) => { const r = ((a % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI); return r > Math.PI ? r - 2*Math.PI : r; };

function makeGearGeo(THREE: TM, teeth: number, moduleMm: number, pa: number, thick: number) {
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
  const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(thick, 6), bevelEnabled: false, curveSegments: 12 });
  geo.center();
  return geo;
}

function makeRingGeo(THREE: TM, ringTeeth: number, moduleMm: number, pa: number, thick: number, wallMm: number) {
  const prof   = generateSpurGearOutline({ teeth: ringTeeth, moduleMm, pressureAngleDeg: pa });
  const outerR = prof.outerRadius + wallMm + moduleMm;
  const shape  = new THREE.Shape();
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    if (i === 0) shape.moveTo(Math.cos(a) * outerR, Math.sin(a) * outerR);
    else         shape.lineTo(Math.cos(a) * outerR, Math.sin(a) * outerR);
  }
  const hole = new THREE.Path();
  prof.outline.forEach((p, i) => { if (i === 0) hole.moveTo(p.x, p.y); else hole.lineTo(p.x, p.y); });
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(thick, 6), bevelEnabled: false, curveSegments: 4 });
  geo.center();
  return geo;
}

function meshOf(THREE: TM, geo: T3.BufferGeometry) {
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0xffffff, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  }));
}
function edgesOf(THREE: TM, geo: T3.BufferGeometry) {
  return new THREE.LineSegments(new THREE.EdgesGeometry(geo, 12), new THREE.LineBasicMaterial({ color: RED }));
}

interface Props extends PlanetaryParams { viewMode: ViewMode; }

export default function PlanetaryCanvas3D({
  sunTeeth, planetTeeth, planetCount, moduleMm, pressureAngleDeg, thicknessMm, viewMode,
}: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const disposeRef = useRef<(() => void) | null>(null);
  const targetRef  = useRef(viewMode === '3d' ? 1 : 0);
  const zoomRef    = useRef(1.0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    (async () => {
      const THREE = await import('three');
      if (cancelled) return;

      const ringTeeth  = planetaryRingTeeth({ sunTeeth, planetTeeth, planetCount, moduleMm, pressureAngleDeg, thicknessMm });
      const R_sun      = (sunTeeth    * moduleMm) / 2;
      const R_planet   = (planetTeeth * moduleMm) / 2;
      const R_ring     = (ringTeeth   * moduleMm) / 2;
      const wallMm     = Math.max(moduleMm * 1.5, 3);
      const outerR     = R_ring + wallMm + moduleMm;
      const orbitR     = R_sun + R_planet;             // planet center orbit radius
      const SC         = 3.0 / outerR;
      const sceneBound = outerR * SC * 1.15;

      // Willis (fixed ring): ω_carrier = ω_sun * N_sun / (N_sun + N_ring)
      const omegaSun     = 1;
      const omegaCarrier = omegaSun * sunTeeth / (sunTeeth + ringTeeth);
      // Planet world rotation: ω_p = ω_c - (ω_sun - ω_c) * N_sun / N_planet
      const omegaPlanet  = omegaCarrier - (omegaSun - omegaCarrier) * sunTeeth / planetTeeth;

      const w = canvas.clientWidth || 900, h = canvas.clientHeight || 550;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0xffffff, 1);

      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(ISO_FOV, w / h, 0.1, 5000);

      const group = new THREE.Group();
      group.scale.setScalar(SC);
      scene.add(group);

      // ── Geometries ────────────────────────────────────────────────────────
      const geoSun    = makeGearGeo(THREE, sunTeeth,  moduleMm, pressureAngleDeg, thicknessMm);
      const geoPlanet = makeGearGeo(THREE, planetTeeth, moduleMm, pressureAngleDeg, thicknessMm);
      const geoRing   = makeRingGeo(THREE, ringTeeth, moduleMm, pressureAngleDeg, thicknessMm, wallMm);

      // ── Sun pivot ─────────────────────────────────────────────────────────
      const sunPivot = new THREE.Group();
      sunPivot.add(meshOf(THREE, geoSun), edgesOf(THREE, geoSun));
      group.add(sunPivot);

      // ── Ring pivot (fixed) ────────────────────────────────────────────────
      const ringPivot = new THREE.Group();
      ringPivot.add(meshOf(THREE, geoRing), edgesOf(THREE, geoRing));
      group.add(ringPivot);

      // ── Planet pivots (N planets, equidistant) ────────────────────────────
      const planetContainers: T3.Group[] = [];
      const planetPivots:     T3.Group[] = [];
      const initialAngles:     number[] = [];
      const planetInitPhase:   number[] = [];

      // Phase offset so each planet's teeth align with the sun at t=0.
      // For odd N_planet a valley falls naturally at π; for even N_planet
      // we need to shift by half a tooth pitch (π/N_planet) to place a valley there.
      const nParityOffset = planetTeeth % 2 === 0 ? Math.PI / planetTeeth : 0;

      for (let i = 0; i < planetCount; i++) {
        const ang = (2 * Math.PI * i) / planetCount;
        initialAngles.push(ang);
        // Rolling-without-slip from sun reference tooth (at 0°) to contact at ang.
        planetInitPhase.push(nParityOffset - (sunTeeth / planetTeeth) * ang);

        const container = new THREE.Group();
        container.position.set(orbitR * Math.cos(ang), orbitR * Math.sin(ang), 0);
        group.add(container);

        const pivot = new THREE.Group();
        pivot.add(meshOf(THREE, geoPlanet), edgesOf(THREE, geoPlanet));
        container.add(pivot);

        planetContainers.push(container);
        planetPivots.push(pivot);
      }

      // ── Grid ──────────────────────────────────────────────────────────────
      const grid = new THREE.GridHelper(80, 40, GRID, GRID);
      (grid.material as T3.Material).transparent = true;
      (grid.material as T3.Material).opacity = 0.3;
      scene.add(grid);

      let progress   = targetRef.current;
      let prevTarget = targetRef.current;
      let rotY = viewMode === '3d' ? 0.4 : 0;
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
      let sunSpin = 0, carrierAngle = 0;
      const planetSpins = new Array(planetCount).fill(0);

      const tick = () => {
        raf = requestAnimationFrame(tick);

        const curTarget = targetRef.current;
        if (curTarget !== prevTarget) {
          if (curTarget < 0.5 && prevTarget >= 0.5) {
            rotY = wrapAngle(rotY); rotX = Math.max(-0.5, Math.min(0.5, rotX));
          }
          prevTarget = curTarget;
        }

        progress += (curTarget - progress) * 0.055;
        const p = easeInOut(Math.max(0, Math.min(1, progress)));

        // Camera
        const fd = sceneBound / Math.tan((FRONT_FOV / 2) * DEG2RAD) * 1.1;
        const id = sceneBound / Math.tan((ISO_FOV  / 2) * DEG2RAD) * 1.44;
        const zoom = zoomRef.current;
        camera.position.set(0, lerp(0, ISO_Y * id, p) * zoom, lerp(fd, ISO_Z * id, p) * zoom);
        camera.fov = lerp(FRONT_FOV, ISO_FOV, p);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();

        group.scale.z = SC * lerp(0.003, 1.0, p);
        if (!dragging && curTarget < 0.5) { rotY *= 0.92; rotX *= 0.92; }
        group.rotation.y = rotY;
        group.rotation.x = rotX;

        grid.rotation.x = lerp(Math.PI / 2, 0, p);
        grid.position.y = lerp(0, -sceneBound * 1.1, p);
        grid.position.z = lerp(-sceneBound * 0.5, 0, p);
        (grid.material as T3.Material).opacity = lerp(0.3, 0.55, p);

        // ── Gear kinematics ──────────────────────────────────────────────
        sunSpin      += OMEGA * omegaSun;
        carrierAngle += OMEGA * omegaCarrier;
        sunPivot.rotation.z = sunSpin;
        // Ring fixed — rotation stays at 0

        for (let i = 0; i < planetCount; i++) {
          planetSpins[i] += OMEGA * omegaPlanet;
          const ang = initialAngles[i]! + carrierAngle;
          planetContainers[i]!.position.set(
            orbitR * Math.cos(ang),
            orbitR * Math.sin(ang),
            0,
          );
          planetPivots[i]!.rotation.z = planetInitPhase[i]! + planetSpins[i];
        }

        renderer.render(scene, camera);
      };
      tick();

      disposeRef.current = () => {
        canvas.removeEventListener('wheel', onWheel);
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointerup',   onUp);
        canvas.removeEventListener('pointermove', onMove);
        ro.disconnect();
        cancelAnimationFrame(raf);
        geoSun.dispose(); geoPlanet.dispose(); geoRing.dispose();
        renderer.dispose();
      };
    })();

    return () => { cancelled = true; disposeRef.current?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sunTeeth, planetTeeth, planetCount, moduleMm, pressureAngleDeg, thicknessMm]);

  useEffect(() => { targetRef.current = viewMode === '3d' ? 1 : 0; }, [viewMode]);

  return <div className="gear3d-wrap"><canvas ref={canvasRef} className="gear3d-canvas" /></div>;
}
