import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
// Shared GPU primitives for the 3D office. Every parametric character/furniture piece used to build
// its OWN geometries and materials inline (16 staff × ~17 meshes each = hundreds of duplicate
// allocations per scene, re-created on every mount). These caches key by the FULL argument set, so
// two callers asking for the same shape/colour share one GPU object while any difference — even a
// segment count or an emissive intensity — gets its own instance. Objects are never disposed:
// the cache owns them for the page's lifetime (bounded: palette colours × distinct shapes), which
// is exactly what makes remounting the scene cheap.
//
// Pass via props (`<mesh geometry={sharedSphere(...)} material={sharedStandard({...})} />`), NOT as
// JSX children — R3F disposes declarative <sphereGeometry> children on unmount, which would kill
// the shared instance for everyone else. Prop-assigned objects are left alone.

const geoCaches = {
  sphere: new Map<string, THREE.SphereGeometry>(),
  box: new Map<string, THREE.BoxGeometry>(),
  capsule: new Map<string, THREE.CapsuleGeometry>(),
  cylinder: new Map<string, THREE.CylinderGeometry>(),
  circle: new Map<string, THREE.CircleGeometry>(),
  torus: new Map<string, THREE.TorusGeometry>(),
  rounded: new Map<string, RoundedBoxGeometry>(),
};

/** args joined in order IS the identity — a missing arg shifts position in the key, not meaning. */
const key = (args: unknown[]) => args.map((a) => String(a)).join("|");

export function sharedSphere(...args: ConstructorParameters<typeof THREE.SphereGeometry>): THREE.SphereGeometry {
  const k = key(args);
  let g = geoCaches.sphere.get(k);
  if (!g) { g = new THREE.SphereGeometry(...args); geoCaches.sphere.set(k, g); }
  return g;
}

export function sharedBox(...args: ConstructorParameters<typeof THREE.BoxGeometry>): THREE.BoxGeometry {
  const k = key(args);
  let g = geoCaches.box.get(k);
  if (!g) { g = new THREE.BoxGeometry(...args); geoCaches.box.set(k, g); }
  return g;
}

export function sharedCapsule(...args: ConstructorParameters<typeof THREE.CapsuleGeometry>): THREE.CapsuleGeometry {
  const k = key(args);
  let g = geoCaches.capsule.get(k);
  if (!g) { g = new THREE.CapsuleGeometry(...args); geoCaches.capsule.set(k, g); }
  return g;
}

export function sharedCylinder(...args: ConstructorParameters<typeof THREE.CylinderGeometry>): THREE.CylinderGeometry {
  const k = key(args);
  let g = geoCaches.cylinder.get(k);
  if (!g) { g = new THREE.CylinderGeometry(...args); geoCaches.cylinder.set(k, g); }
  return g;
}

export function sharedCircle(...args: ConstructorParameters<typeof THREE.CircleGeometry>): THREE.CircleGeometry {
  const k = key(args);
  let g = geoCaches.circle.get(k);
  if (!g) { g = new THREE.CircleGeometry(...args); geoCaches.circle.set(k, g); }
  return g;
}

export function sharedTorus(...args: ConstructorParameters<typeof THREE.TorusGeometry>): THREE.TorusGeometry {
  const k = key(args);
  let g = geoCaches.torus.get(k);
  if (!g) { g = new THREE.TorusGeometry(...args); geoCaches.torus.set(k, g); }
  return g;
}

/** Rounded box (drei's <RoundedBox> geometry) — (width, height, depth, segments, radius). Same
 *  shape as the JSX helper so a conversion is a mechanical args copy. */
export function sharedRounded(
  width: number,
  height: number,
  depth: number,
  segments: number,
  radius: number,
): RoundedBoxGeometry {
  const k = `${width}|${height}|${depth}|${segments}|${radius}`;
  let g = geoCaches.rounded.get(k);
  if (!g) { g = new RoundedBoxGeometry(width, height, depth, segments, radius); geoCaches.rounded.set(k, g); }
  return g;
}

export interface StandardMatProps {
  color?: string | number;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  depthWrite?: boolean;
  toneMapped?: boolean;
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();

/** A MeshStandardMaterial keyed by EVERY prop that can vary between callers. Two meshes sharing a
 *  cached material must never want different values of anything in the key — so all of them go in. */
export function sharedStandard(p: StandardMatProps): THREE.MeshStandardMaterial {
  const k = `${p.color ?? ""}|${p.roughness ?? ""}|${p.metalness ?? ""}|${p.emissive ?? ""}|${p.emissiveIntensity ?? ""}|${p.transparent ? 1 : 0}|${p.opacity ?? ""}|${p.depthWrite == null ? "" : p.depthWrite ? 1 : 0}|${p.toneMapped == null ? "" : p.toneMapped ? 1 : 0}`;
  let m = matCache.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: p.color,
      roughness: p.roughness,
      metalness: p.metalness,
      emissive: p.emissive,
      emissiveIntensity: p.emissiveIntensity,
      transparent: p.transparent,
      opacity: p.opacity,
      depthWrite: p.depthWrite,
      toneMapped: p.toneMapped,
    });
    matCache.set(k, m);
  }
  return m;
}
