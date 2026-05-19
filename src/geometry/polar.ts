// All geometry works in math coordinates: Y axis points UP (standard math convention).
// SVG coordinates have Y pointing DOWN — conversion happens only at render time.

export interface Point2D {
  x: number;
  y: number;
}

export interface ViewportTransform {
  cx: number;          // SVG center X of the gear (pixels)
  cy: number;          // SVG center Y of the gear (pixels)
  scale: number;       // px per mm
  rotationRad?: number; // CCW rotation in math-coord radians
}

export function polarToCartesian(r: number, theta: number): Point2D {
  return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
}

export function rotatePoint(p: Point2D, angle: number): Point2D {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

export function mirrorY(p: Point2D): Point2D {
  return { x: p.x, y: -p.y };
}

/**
 * Convert math-coord gear outline to a LOCAL SVG path string.
 * Applies scale and Y-flip only — no translation, no rotation.
 * Use inside <g transform="translate(cx, cy)"> so the <g> handles positioning,
 * and wrap in another <g ref={…}> for SVG transform-based rotation animation.
 */
export function toLocalSvgPath(points: Point2D[], scale: number): string {
  const svgPts = points.map((p) => ({ x: p.x * scale, y: -p.y * scale }));
  return pointsToSvgPath(svgPts);
}

/** Convert an array of math-coord points to a SVG path string ("M x y L x y … Z") */
export function pointsToSvgPath(points: Point2D[], close = true): string {
  if (points.length === 0) return '';
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
  return close ? `${d} Z` : d;
}

/**
 * Transforms math-coord geometry (mm, Y up, centered at origin) into SVG pixel coords.
 *  - applies optional CCW rotation in math space
 *  - scales mm → pixels
 *  - translates to (cx, cy)
 *  - flips Y axis (math Y up → SVG Y down)
 */
export function applyViewport(points: Point2D[], vp: ViewportTransform): Point2D[] {
  const rot = vp.rotationRad ?? 0;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return points.map((p) => {
    const rx = p.x * c - p.y * s;
    const ry = p.x * s + p.y * c;
    return {
      x: vp.cx + rx * vp.scale,
      y: vp.cy - ry * vp.scale, // negate: math Y up → SVG Y down
    };
  });
}
