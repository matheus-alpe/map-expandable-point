export const LEAF = 36; // leaf diameter, px
const GAP = 8;
export const CIRCLE_MAX = 9;

export type Pt = { x: number; y: number };

/** Pixel offsets from the center: a ring for small n, an Archimedean spiral beyond. */
export function layout(n: number): Pt[] {
  const step = LEAF + GAP;
  if (n <= CIRCLE_MAX) {
    // chord between neighbours must be >= step: r = step / (2 sin(π/n))
    const r = Math.max(48, step / (2 * Math.sin(Math.PI / Math.max(n, 2))));
    return Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return { x: r * Math.cos(a), y: r * Math.sin(a) };
    });
  }
  // r = r0 + bθ, with b so consecutive turns sit `step` apart; advance θ by arc length `step`.
  const b = step / (2 * Math.PI);
  let r = 44;
  let theta = r / b;
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    pts.push({ x: r * Math.cos(theta), y: r * Math.sin(theta) });
    theta += step / r;
    r = b * theta;
  }
  return pts;
}
