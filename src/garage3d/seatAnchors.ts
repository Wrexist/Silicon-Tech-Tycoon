// Runtime seat height follows the fitted asset, with the procedural cushion as loading fallback.
const surfaces = new Map<string, number>();
export function publishSeatSurface(url: string, height: number): void {
 if(Number.isFinite(height) && height>0)surfaces.set(url,height);
}
export function sofaSeatSurface(): number { return surfaces.get('furniture/sofa.glb') ?? 0.48; }
// Keep seat contact consistent with the shared parametric character scale.
export const ROBOT_SCALE = 1.1;
export const ROBOT_SEATED_UNDERSIDE = (0.6 - 0.3 - 0.16) * ROBOT_SCALE;
export function robotSeatLift(surface: number): number { return surface-ROBOT_SEATED_UNDERSIDE; }
