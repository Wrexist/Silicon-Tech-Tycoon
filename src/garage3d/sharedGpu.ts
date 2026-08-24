import * as THREE from "three";
import { toCreasedNormals } from "three-stdlib";
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
  cone: new Map<string, THREE.ConeGeometry>(),
  plane: new Map<string, THREE.PlaneGeometry>(),
  ring: new Map<string, THREE.RingGeometry>(),
  rounded: new Map<string, THREE.BufferGeometry>(),
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

export function sharedCone(...args: ConstructorParameters<typeof THREE.ConeGeometry>): THREE.ConeGeometry {
  const k = key(args);
  let g = geoCaches.cone.get(k);
  if (!g) { g = new THREE.ConeGeometry(...args); geoCaches.cone.set(k, g); }
  return g;
}

export function sharedPlane(...args: ConstructorParameters<typeof THREE.PlaneGeometry>): THREE.PlaneGeometry {
  const k = key(args);
  let g = geoCaches.plane.get(k);
  if (!g) { g = new THREE.PlaneGeometry(...args); geoCaches.plane.set(k, g); }
  return g;
}

export function sharedRing(...args: ConstructorParameters<typeof THREE.RingGeometry>): THREE.RingGeometry {
  const k = key(args);
  let g = geoCaches.ring.get(k);
  if (!g) { g = new THREE.RingGeometry(...args); geoCaches.ring.set(k, g); }
  return g;
}

/** Rounded box — (width, height, depth, smoothness, radius), matching drei's `<RoundedBox>` prop
 *  set so a conversion is a mechanical args copy (smoothness defaults to 4, radius to 0.05, like
 *  the JSX helper). Built EXACTLY the way drei builds it — the same rounded-rect extrude with
 *  creased normals — so a converted mesh is the identical geometry, not a lookalike: the
 *  three-stdlib RoundedBoxGeometry this cache used before is a subdivided box with different
 *  shading, which is why it was replaced. */
export function sharedRounded(
  width: number,
  height: number,
  depth: number,
  smoothness = 4,
  radius = 0.05,
): THREE.BufferGeometry {
  const k = `${width}|${height}|${depth}|${smoothness}|${radius}`;
  let g = geoCaches.rounded.get(k);
  if (!g) {
    // drei RoundedBox internals (core/RoundedBox.js): a rounded-rect Shape extruded depth-wise
    // with the radius as bevel, centred, then creased normals at drei's fixed 0.4 angle.
    const eps = 0.00001;
    const r = radius - eps;
    const shape = new THREE.Shape();
    shape.absarc(eps, eps, eps, -Math.PI / 2, -Math.PI, true);
    shape.absarc(eps, height - r * 2, eps, Math.PI, Math.PI / 2, true);
    shape.absarc(width - r * 2, height - r * 2, eps, Math.PI / 2, 0, true);
    shape.absarc(width - r * 2, eps, eps, 0, -Math.PI / 2, true);
    const extruded = new THREE.ExtrudeGeometry(shape, {
      depth: depth - radius * 2,
      bevelEnabled: true,
      bevelSegments: 8, // drei: bevelSegments (default 4) × 2
      steps: 1,
      bevelSize: radius - eps,
      bevelThickness: radius,
      curveSegments: smoothness,
    });
    extruded.center();
    g = toCreasedNormals(extruded, 0.4);
    geoCaches.rounded.set(k, g);
  }
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
  side?: THREE.Side;
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();

/** Material.setValues warns (per key, per construction) on undefined params — strip them. */
function defined<T extends object>(p: T): T {
  const out = {} as T;
  for (const k in p) if (p[k] !== undefined) out[k] = p[k];
  return out;
}

/** A MeshStandardMaterial keyed by EVERY prop that can vary between callers. Two meshes sharing a
 *  cached material must never want different values of anything in the key — so all of them go in. */
export function sharedStandard(p: StandardMatProps): THREE.MeshStandardMaterial {
  const k = `${p.color ?? ""}|${p.roughness ?? ""}|${p.metalness ?? ""}|${p.emissive ?? ""}|${p.emissiveIntensity ?? ""}|${p.transparent ? 1 : 0}|${p.opacity ?? ""}|${p.depthWrite == null ? "" : p.depthWrite ? 1 : 0}|${p.toneMapped == null ? "" : p.toneMapped ? 1 : 0}|${p.side ?? ""}`;
  let m = matCache.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial(defined({
      color: p.color,
      roughness: p.roughness,
      metalness: p.metalness,
      emissive: p.emissive,
      emissiveIntensity: p.emissiveIntensity,
      transparent: p.transparent,
      opacity: p.opacity,
      depthWrite: p.depthWrite,
      toneMapped: p.toneMapped,
      side: p.side,
    }));
    matCache.set(k, m);
  }
  return m;
}

export interface BasicMatProps {
  color?: string | number;
  transparent?: boolean;
  opacity?: number;
  depthWrite?: boolean;
  toneMapped?: boolean;
  side?: THREE.Side;
  wireframe?: boolean;
}

const basicCache = new Map<string, THREE.MeshBasicMaterial>();

/** A MeshBasicMaterial from the same pool discipline as sharedStandard — every varying prop keys. */
export function sharedBasic(p: BasicMatProps): THREE.MeshBasicMaterial {
  const k = `${p.color ?? ""}|${p.transparent ? 1 : 0}|${p.opacity ?? ""}|${p.depthWrite == null ? "" : p.depthWrite ? 1 : 0}|${p.toneMapped == null ? "" : p.toneMapped ? 1 : 0}|${p.side ?? ""}|${p.wireframe ? 1 : 0}`;
  let m = basicCache.get(k);
  if (!m) {
    m = new THREE.MeshBasicMaterial(defined({
      color: p.color,
      transparent: p.transparent,
      opacity: p.opacity,
      depthWrite: p.depthWrite,
      toneMapped: p.toneMapped,
      side: p.side,
      wireframe: p.wireframe,
    }));
    basicCache.set(k, m);
  }
  return m;
}

export interface PhysicalMatProps {
  color?: string | number;
  roughness?: number;
  metalness?: number;
  transparent?: boolean;
  opacity?: number;
  transmission?: number;
  thickness?: number;
  side?: THREE.Side;
}

const physicalCache = new Map<string, THREE.MeshPhysicalMaterial>();

/** A MeshPhysicalMaterial pool for the handful of glass panes (aquarium, focus pod, trophy case). */
export function sharedPhysical(p: PhysicalMatProps): THREE.MeshPhysicalMaterial {
  const k = `${p.color ?? ""}|${p.roughness ?? ""}|${p.metalness ?? ""}|${p.transparent ? 1 : 0}|${p.opacity ?? ""}|${p.transmission ?? ""}|${p.thickness ?? ""}|${p.side ?? ""}`;
  let m = physicalCache.get(k);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial(defined({
      color: p.color,
      roughness: p.roughness,
      metalness: p.metalness,
      transparent: p.transparent,
      opacity: p.opacity,
      transmission: p.transmission,
      thickness: p.thickness,
      side: p.side,
    }));
    physicalCache.set(k, m);
  }
  return m;
}
