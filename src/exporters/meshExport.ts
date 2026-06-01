/**
 * 3D mesh export — STL (ASCII) and OBJ with vertex normals.
 *
 * Cap triangulation uses a zipper algorithm so that:
 *   • Every outer profile edge and every bore edge appears in exactly one cap triangle.
 *   • No gaps and no duplicate edges (watertight, 2-manifold mesh).
 *
 * Winding convention: CCW when viewed from the outside of the solid.
 *   front cap  (z = 0)      → normal toward −Z  → winding is CW in XY (flip = true)
 *   back cap   (z = thick)  → normal toward +Z  → winding is CCW in XY (flip = false)
 *   outer wall              → normal away from gear center
 *   bore wall               → normal toward bore center (outward from solid)
 */

import { generateSpurGearOutline } from '../geometry/spurGear2D';

type Vec3 = readonly [number, number, number];
type Tri  = [Vec3, Vec3, Vec3];
type XY   = readonly [number, number];

export interface GearMeshParams {
  teeth:            number;
  moduleMm:         number;
  pressureAngleDeg: number;
  boreDiameterMm:   number;
  thicknessMm:      number;
  quality?:         number; // involute steps per flank (default 24)
}

// ── Vector math ───────────────────────────────────────────────────────────────

const sub  = (a: Vec3, b: Vec3): Vec3 => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0],
];
function normalize(v: Vec3): Vec3 {
  const l = Math.sqrt(v[0]**2 + v[1]**2 + v[2]**2);
  return l < 1e-14 ? [0, 0, 1] : [v[0]/l, v[1]/l, v[2]/l];
}
const triNormal = (t: Tri): Vec3 => normalize(cross(sub(t[1], t[0]), sub(t[2], t[0])));
const flipTri   = (t: Tri): Tri  => [t[0], t[2], t[1]];

// ── Bore circle ───────────────────────────────────────────────────────────────

const M_BORE = 64; // bore polygon segments (high enough for smooth hole)

function circleXY(r: number, m: number): XY[] {
  return Array.from({ length: m }, (_, i) => {
    const a = (i / m) * 2 * Math.PI;
    return [r * Math.cos(a), r * Math.sin(a)] as XY;
  });
}

// ── Zipper cap triangulation ──────────────────────────────────────────────────
// Correctly triangulates the annular region between the outer profile (N points,
// CCW in profile order) and the bore circle (M points, CCW from angle 0).
// Each outer edge and each inner edge appears in exactly one triangle → manifold.

function zipperCap(outer: XY[], inner: XY[], z: number, flip: boolean): Tri[] {
  const N = outer.length, M = inner.length;
  const v = ([x, y]: XY): Vec3 => [x, y, z];
  const tris: Tri[] = [];

  // Cumulative CCW angle traversed by the outer profile from outer[0].
  // Non-monotone sections (tooth flanks going "back" slightly) are clamped to 0.
  const toA = ([x, y]: XY) => { const a = Math.atan2(y, x); return a < 0 ? a + 2*Math.PI : a; };
  const outerCum: number[] = [0]; // length N+1 (index N = closing step back to outer[0])
  for (let i = 1; i <= N; i++) {
    const prev = toA(outer[(i-1) % N]!);
    const curr = toA(outer[i     % N]!);
    let da = curr - prev;
    if (da < -Math.PI) da += 2*Math.PI; // unwrap
    if (da >  Math.PI) da -= 2*Math.PI;
    outerCum.push(outerCum[i-1]! + Math.max(0, da));
  }
  // Ensure closing step reaches 2π (the clamping might leave it slightly under)
  if (outerCum[N]! < 2*Math.PI * 0.95) outerCum[N] = 2*Math.PI;

  // Align inner start so inner[startII] is closest to outer[0]'s angle
  const base   = toA(outer[0]!);
  const startII = Math.round((base / (2*Math.PI)) * M) % M;
  const iStep  = (2*Math.PI) / M;

  let oi = 0, ii = 0; // step counters (oi advances 0→N, ii advances 0→M)

  const push = (a: XY, b: XY, c: XY) => {
    const t: Tri = [v(a), v(b), v(c)];
    tris.push(flip ? flipTri(t) : t);
  };

  for (let step = 0; step < N + M; step++) {
    const nextOuterA = oi < N ? outerCum[oi + 1]! : Infinity;
    const nextInnerA = ii < M ? (ii + 1) * iStep   : Infinity;

    const oA = outer[oi % N]!;
    const oB = outer[(oi + 1) % N]!;
    const iA = inner[(startII + ii) % M]!;
    const iB = inner[(startII + ii + 1) % M]!;

    if (nextOuterA <= nextInnerA) {
      push(oA, oB, iA); // advance outer: tri (outer[oi], outer[oi+1], inner[ii])
      oi++;
    } else {
      push(oA, iB, iA); // advance inner: tri (outer[oi], inner[ii+1], inner[ii])
      ii++;
    }
  }

  return tris;
}

// ── Full gear mesh ────────────────────────────────────────────────────────────

function buildTriangles(p: GearMeshParams): Tri[] {
  const { boreDiameterMm, thicknessMm, quality = 24 } = p;
  const boreR = boreDiameterMm / 2;
  const thick = thicknessMm;

  const geo     = generateSpurGearOutline({ ...p, quality });
  const outer   = geo.outline.map(pt => [pt.x, pt.y] as XY);
  const inner   = circleXY(boreR, M_BORE);
  const N       = outer.length;
  const tris: Tri[] = [];

  // ── Outer side wall (normals point away from gear center) ─────────────────
  // Outer profile is CCW. For outward normals: traverse CW when viewed from outside.
  // Quad split: front-face edge = outer[i]→outer[j], winding must be CCW when
  // viewed from the outside (outward), meaning CW in XY for +X/+Y facing normals.
  // Verified: normal = thick*(dy, -dx) which is the outward CCW-polygon perpendicular ✓
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    const [x0, y0] = outer[i]!, [x1, y1] = outer[j]!;
    tris.push([[x0,y0,0],    [x1,y1,0],    [x1,y1,thick]]);
    tris.push([[x0,y0,0],    [x1,y1,thick],[x0,y0,thick]]);
  }

  // ── Inner bore wall (normals face inward toward bore center) ──────────────
  // Bore is CCW. For inward normals: reverse winding → CW traversal.
  // Verified: normal = thick*(-dy, dx) which is the inward direction for CCW circle ✓
  for (let i = 0; i < M_BORE; i++) {
    const j = (i + 1) % M_BORE;
    const [x0, y0] = inner[i]!, [x1, y1] = inner[j]!;
    tris.push([[x0,y0,0],    [x1,y1,thick],[x1,y1,0]   ]);
    tris.push([[x0,y0,0],    [x0,y0,thick],[x1,y1,thick]]);
  }

  // ── Caps (annular region between outer profile and bore) ──────────────────
  tris.push(...zipperCap(outer, inner, 0,     true));  // front: z=0, −Z normal
  tris.push(...zipperCap(outer, inner, thick, false)); // back:  z=T, +Z normal

  return tris;
}

// ── STL export ────────────────────────────────────────────────────────────────

export function exportGearStl(params: GearMeshParams, label = 'gear'): string {
  const tris = buildTriangles(params);
  const f4   = (n: number) => n.toFixed(4);
  const f6   = (n: number) => n.toFixed(6);
  const lines = [`solid ${label}`];
  for (const t of tris) {
    const n = triNormal(t);
    lines.push(
      `  facet normal ${f6(n[0])} ${f6(n[1])} ${f6(n[2])}`,
      `    outer loop`,
      `      vertex ${f4(t[0][0])} ${f4(t[0][1])} ${f4(t[0][2])}`,
      `      vertex ${f4(t[1][0])} ${f4(t[1][1])} ${f4(t[1][2])}`,
      `      vertex ${f4(t[2][0])} ${f4(t[2][1])} ${f4(t[2][2])}`,
      `    endloop`,
      `  endfacet`,
    );
  }
  lines.push(`endsolid ${label}`);
  return lines.join('\n');
}

// ── OBJ export (with per-vertex smooth normals) ───────────────────────────────

export function exportGearObj(params: GearMeshParams, label = 'gear'): string {
  const tris = buildTriangles(params);
  const f5   = (n: number) => n.toFixed(5);

  // ── Deduplicate vertices ──────────────────────────────────────────────────
  const vKey   = (v: Vec3) => `${f5(v[0])},${f5(v[1])},${f5(v[2])}`;
  const vMap   = new Map<string, number>(); // key → 0-indexed
  const verts: Vec3[] = [];
  const faces: [number, number, number][] = [];

  const vIdx = (v: Vec3) => {
    const k = vKey(v);
    if (!vMap.has(k)) { vMap.set(k, verts.length); verts.push(v); }
    return vMap.get(k)!;
  };

  for (const t of tris) {
    faces.push([vIdx(t[0]), vIdx(t[1]), vIdx(t[2])]);
  }

  // ── Compute per-vertex smooth normals ─────────────────────────────────────
  const vnAccum: [number, number, number][] = verts.map(() => [0, 0, 0]);
  for (let fi = 0; fi < faces.length; fi++) {
    const [a, b, c] = faces[fi]!;
    const n = triNormal(tris[fi]!);
    for (const vi of [a, b, c]) {
      vnAccum[vi]![0] += n[0];
      vnAccum[vi]![1] += n[1];
      vnAccum[vi]![2] += n[2];
    }
  }
  const vnNorm = vnAccum.map(v => {
    const l = Math.sqrt(v[0]**2 + v[1]**2 + v[2]**2);
    return l < 1e-14 ? [0, 0, 1] as Vec3 : [v[0]/l, v[1]/l, v[2]/l] as Vec3;
  });

  // ── Write OBJ ─────────────────────────────────────────────────────────────
  const lines: string[] = [
    `# Gear — teeth:${params.teeth} module:${params.moduleMm}mm PA:${params.pressureAngleDeg}°`,
    `# Pitch Ø ${params.teeth * params.moduleMm}mm  Outer Ø ${(params.teeth + 2) * params.moduleMm}mm  thickness:${params.thicknessMm}mm`,
    `# Units: millimetres`,
    ``,
    `o ${label}`,
    ``,
    ...verts.map(([x, y, z]) => `v  ${f5(x)}  ${f5(y)}  ${f5(z)}`),
    ``,
    ...vnNorm.map(([x, y, z]) => `vn ${f5(x)}  ${f5(y)}  ${f5(z)}`),
    ``,
    `s off`,
    ...faces.map(([a, b, c]) =>
      `f ${a+1}//${a+1} ${b+1}//${b+1} ${c+1}//${c+1}`
    ),
  ];
  return lines.join('\n');
}

// ── Ring gear (hollow cylinder — simplified for STL/OBJ) ──────────────────────
// For accurate internal-teeth geometry use the STEP export.

export interface RingGearMeshParams {
  ringTeeth:       number;
  moduleMm:        number;
  thicknessMm:     number;
  wallThicknessMm?: number;
}

function buildRingGearTriangles(p: RingGearMeshParams): Tri[] {
  const wall   = p.wallThicknessMm ?? 3;
  const thick  = p.thicknessMm;
  const outerR = (p.ringTeeth + 2.5) * p.moduleMm / 2 + wall;
  const innerR = (p.ringTeeth - 2)   * p.moduleMm / 2;   // inner addendum circle

  const M     = 96;
  const outer = circleXY(outerR, M);
  const inner = circleXY(innerR, M);
  const tris: Tri[] = [];

  for (let i = 0; i < M; i++) {
    const j = (i + 1) % M;
    const [x0,y0] = outer[i]!, [x1,y1] = outer[j]!;
    tris.push([[x0,y0,0], [x1,y1,0], [x1,y1,thick]]);
    tris.push([[x0,y0,0], [x1,y1,thick], [x0,y0,thick]]);
    const [a0,b0] = inner[i]!, [a1,b1] = inner[j]!;
    tris.push([[a0,b0,0], [a1,b1,thick], [a1,b1,0]]);
    tris.push([[a0,b0,0], [a0,b0,thick], [a1,b1,thick]]);
  }

  tris.push(...zipperCap(outer, inner, 0,     true));
  tris.push(...zipperCap(outer, inner, thick, false));
  return tris;
}

export function exportRingGearStl(p: RingGearMeshParams, label = 'ring-gear'): string {
  const tris = buildRingGearTriangles(p);
  const f4 = (n: number) => n.toFixed(4);
  const f6 = (n: number) => n.toFixed(6);
  const lines = [`solid ${label}`];
  for (const t of tris) {
    const n = triNormal(t);
    lines.push(
      `  facet normal ${f6(n[0])} ${f6(n[1])} ${f6(n[2])}`,
      `    outer loop`,
      `      vertex ${f4(t[0][0])} ${f4(t[0][1])} ${f4(t[0][2])}`,
      `      vertex ${f4(t[1][0])} ${f4(t[1][1])} ${f4(t[1][2])}`,
      `      vertex ${f4(t[2][0])} ${f4(t[2][1])} ${f4(t[2][2])}`,
      `    endloop`,
      `  endfacet`,
    );
  }
  lines.push(`endsolid ${label}`);
  return lines.join('\n');
}

export function exportRingGearObj(p: RingGearMeshParams, label = 'ring-gear'): string {
  const tris = buildRingGearTriangles(p);
  const f5 = (n: number) => n.toFixed(5);
  const vKey = (v: Vec3) => `${f5(v[0])},${f5(v[1])},${f5(v[2])}`;
  const vMap = new Map<string, number>(); const verts: Vec3[] = [];
  const faces: [number,number,number][] = [];
  const vIdx = (v: Vec3) => { const k = vKey(v); if (!vMap.has(k)) { vMap.set(k, verts.length); verts.push(v); } return vMap.get(k)!; };
  for (const t of tris) faces.push([vIdx(t[0]), vIdx(t[1]), vIdx(t[2])]);
  const vnAcc: [number,number,number][] = verts.map(() => [0,0,0]);
  for (let fi = 0; fi < faces.length; fi++) {
    const [a,b,c] = faces[fi]!; const n = triNormal(tris[fi]!);
    for (const vi of [a,b,c]) { vnAcc[vi]![0]+=n[0]; vnAcc[vi]![1]+=n[1]; vnAcc[vi]![2]+=n[2]; }
  }
  const vn = vnAcc.map(v => { const l=Math.sqrt(v[0]**2+v[1]**2+v[2]**2); return l<1e-14?[0,0,1] as Vec3:[v[0]/l,v[1]/l,v[2]/l] as Vec3; });
  return [
    `# Ring Gear — z=${p.ringTeeth} m=${p.moduleMm} thickness=${p.thicknessMm}mm (simplified, no internal teeth)`,
    `o ${label}`, ``,
    ...verts.map(([x,y,z]) => `v  ${f5(x)}  ${f5(y)}  ${f5(z)}`), ``,
    ...vn.map(([x,y,z]) => `vn ${f5(x)}  ${f5(y)}  ${f5(z)}`), ``,
    `s off`,
    ...faces.map(([a,b,c]) => `f ${a+1}//${a+1} ${b+1}//${b+1} ${c+1}//${c+1}`),
  ].join('\n');
}
