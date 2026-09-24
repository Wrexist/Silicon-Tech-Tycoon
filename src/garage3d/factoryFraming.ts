import * as THREE from 'three';

/** Fit the actual workshop and dock, rather than a sphere around the surrounding landscape. */
export function factoryFrame(aspect: number, cx: number, margin = 1.08) {
  const portrait = aspect < 1;
  const target = new THREE.Vector3(portrait ? 0 : cx, 0.8, portrait ? -cx : 0);
  const direction = new THREE.Vector3(portrait ? 0.45 : 0.9, 1.2, 1).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  const fov = 38;
  const tanV = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const tanH = tanV * Math.max(.1, aspect);
  const corners: THREE.Vector3[] = [];
  let distance = 0;
  for (const x of [-11.5, 8.8 + cx * 2]) for (const y of [-.2, 3.6]) for (const z of [-6, 6.2]) {
    const point = portrait ? new THREE.Vector3(z, y, -x) : new THREE.Vector3(x, y, z);
    corners.push(point);
    const offset = point.clone().sub(target);
    distance = Math.max(distance, offset.dot(direction) + Math.max(Math.abs(offset.dot(right)) / tanH, Math.abs(offset.dot(up)) / tanV) * margin);
  }
  return { target, position: target.clone().addScaledVector(direction, distance), fov, corners };
}
