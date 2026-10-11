import * as THREE from 'three';

// One framing rule for both 3D worlds (office card + factory card/fullscreen): look along a fixed
// direction, slide the pivot across the floor until the box of what must be seen sits CENTRED in
// the frame, then pull back just far enough to fit it. Pure maths — no scene, no renderer — so the
// framing tests can check it for every aspect a phone, iPad or desktop card produces.

export interface CentredFit {
  /** Orbit pivot: on the `pivotY` plane, slid so the projected box is balanced in the frame. */
  target: THREE.Vector3;
  /** Camera position = target + direction × distance. */
  position: THREE.Vector3;
  distance: number;
}

/**
 * @param corners  points that must be framed (world space)
 * @param direction unit vector from the pivot towards the camera
 * @param fov      vertical field of view, degrees
 * @param margin   >1 leaves breathing room around the tight axis
 * @param crop     ≤1 lets the box overflow the frame SIDEWAYS by up to 1/crop (a wide diorama in
 *                 a squarish card fills it instead of floating in a band); 1 = never crop
 */
export function fitCentred(corners: THREE.Vector3[], direction: THREE.Vector3, fov: number, aspect: number,
  { margin = 1, crop = 1, pivotY = 0 }: { margin?: number; crop?: number; pivotY?: number } = {}): CentredFit {
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  // Screen-up projected onto the floor: sliding the pivot along it moves the picture vertically
  // while the pivot stays at its working height.
  const ahead = new THREE.Vector3(-direction.x, 0, -direction.z).normalize();
  const tanV = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const tanH = tanV * Math.max(.1, aspect);
  const target = new THREE.Box3().setFromPoints(corners).getCenter(new THREE.Vector3()).setY(pivotY);
  const offset = new THREE.Vector3();
  let distance = 0;
  const fit = () => {
    distance = 0;
    for (const point of corners) {
      offset.copy(point).sub(target);
      distance = Math.max(distance, offset.dot(direction) + Math.max(Math.abs(offset.dot(right)) / tanH * crop, Math.abs(offset.dot(up)) / tanV) * margin);
    }
  };
  // A few passes converge to well under a pixel: each measures how lopsided the projected box is at
  // the current distance, slides the pivot by that much, and re-fits the distance.
  for (let pass = 0; pass < 8; pass++) {
    fit();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const point of corners) {
      offset.copy(point).sub(target);
      const depth = distance - offset.dot(direction);
      const sx = offset.dot(right) / (depth * tanH), sy = offset.dot(up) / (depth * tanV);
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    if (Math.abs(mx) < 1e-4 && Math.abs(my) < 1e-4) break;
    target.addScaledVector(right, mx * distance * tanH);
    target.addScaledVector(ahead, (my * distance * tanV) / ahead.dot(up));
  }
  fit();
  return { target, position: target.clone().addScaledVector(direction, distance), distance };
}
