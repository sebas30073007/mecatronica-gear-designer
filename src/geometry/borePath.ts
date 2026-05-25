import type { Point2D } from './polar';
import type { BoreType } from '../core/gearTypes';

const N = 36;

/**
 * Returns a closed outline (CCW, math coords Y-up) for the given bore type.
 * Returns [] when type is 'none' — caller omits the hole entirely.
 */
export function generateBoreOutline(type: BoreType, diameterMm: number): Point2D[] {
  const r = diameterMm / 2;
  if (type === 'none' || r <= 0) return [];

  if (type === 'round') {
    return Array.from({ length: N + 1 }, (_, i) => ({
      x: Math.cos((i / N) * Math.PI * 2) * r,
      y: Math.sin((i / N) * Math.PI * 2) * r,
    }));
  }

  if (type === 'd-shaft') {
    // Flat chord at y = 0.82r (removes small cap at top)
    const flatY = r * 0.82;
    const flatX = Math.sqrt(r * r - flatY * flatY);
    const startAngle = Math.atan2(flatY, flatX);   // ~55° — right corner
    const arcSpan    = Math.PI + 2 * startAngle;   // ~290° of arc
    // CCW from left corner (π-α) through bottom to right corner (α+2π≡α)
    const pts: Point2D[] = Array.from({ length: N + 1 }, (_, i) => {
      const a = (Math.PI - startAngle) + (i / N) * arcSpan;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r };
    });
    // pts[0]=left corner, pts[N]=right corner; caller closes flat chord back to pts[0]
    return pts;
  }

  if (type === 'keyway') {
    const hw       = diameterMm / 8;               // half-width of slot (d/4 total)
    const slotH    = diameterMm / 8;               // slot depth
    const sideY    = Math.sqrt(r * r - hw * hw);
    const startAngle = Math.atan2(sideY, hw);
    const arcSpan    = Math.PI + 2 * startAngle;
    const pts: Point2D[] = Array.from({ length: N + 1 }, (_, i) => {
      const a = (Math.PI - startAngle) + (i / N) * arcSpan;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r };
    });
    // pts[0]=(-hw, sideY), pts[N]=(hw, sideY) — add slot corners at top, then close
    pts.push({ x:  hw, y: r + slotH });  // upper-right
    pts.push({ x: -hw, y: r + slotH });  // upper-left → closes to pts[0]
    return pts;
  }

  return [];
}
