// Continuous-curvature ("squircle") rounded-rect SVG path — like Apple hardware corners,
// never a plain circular-arc rounded rect. PURE (returns a path string).

/**
 * Build a squircle path for the rect (x, y, w, h) with corner radius r.
 * `smoothing` 0..1 pushes the bezier handles to flatten the corner's midpoint and
 * fill its extremes, approximating a superellipse. 0.6 is a good default.
 */
export function squircle(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  smoothing = 0.6,
): string {
  const radius = Math.min(r, w / 2, h / 2);
  // Clamp smoothing to [0,1] so an out-of-range value can't push the bezier handles past the
  // corner and bulge it outward.
  const s = Math.max(0, Math.min(1, smoothing));
  // Handle offset from the corner along each edge. Lower = squarer corner mid, rounder tips.
  // Floor at 0 so the control point never crosses to the far side of the corner.
  const k = Math.max(0, radius * (1 - 0.55 * (1 + s * 0.4)));
  const right = x + w;
  const bottom = y + h;
  return [
    `M ${x + radius} ${y}`,
    `L ${right - radius} ${y}`,
    `C ${right - k} ${y} ${right} ${y + k} ${right} ${y + radius}`,
    `L ${right} ${bottom - radius}`,
    `C ${right} ${bottom - k} ${right - k} ${bottom} ${right - radius} ${bottom}`,
    `L ${x + radius} ${bottom}`,
    `C ${x + k} ${bottom} ${x} ${bottom - k} ${x} ${bottom - radius}`,
    `L ${x} ${y + radius}`,
    `C ${x} ${y + k} ${x + k} ${y} ${x + radius} ${y}`,
    "Z",
  ].join(" ");
}
