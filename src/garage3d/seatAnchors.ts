// Runtime seat height follows the fitted asset, with the procedural cushion as loading fallback.
const surfaces = new Map<string, number>();
export function publishSeatSurface(url: string, height: number): void {
 if(Number.isFinite(height) && height>0)surfaces.set(url,height);
}
export function sofaSeatSurface(): number { return surfaces.get('furniture/sofa.glb') ?? 0.48; }
// Parametric torso underside: (centre .6 - capsule radius .3 - half cylinder .16) * scale 1.25.
export const ROBOT_SEATED_UNDERSIDE = 0.175;
export function robotSeatLift(surface: number): number { return surface-ROBOT_SEATED_UNDERSIDE; }
