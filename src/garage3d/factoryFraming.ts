import * as THREE from 'three';
import { fitCentred } from './cameraFit.ts';

// What the default view must always show, in world units before the portrait rotation: the dock and
// truck on the west (with a little road behind the truck), the building (plus any previewed bay)
// growing east by 2·cx, the shell's depth, and the tallest machine head. A previewed bay is only a
// ghost slab with low walls, so its end of the box stops at BAY_TOP instead of machine height.
// Lights and the grounds are deliberately outside the box.
const WEST = -14.2, EAST = 8.8, NORTH = -6, SOUTH = 6.2, FLOOR_Y = -0.2, TOP_Y = 2.8, BAY_TOP = 1.5;

/** Fit the actual workshop and dock, rather than a sphere around the surrounding landscape. The box
 *  is CENTRED in the frame (see cameraFit.ts), so the floor uses the whole frame instead of leaving
 *  one side empty — the old fit kept the pivot on the building and filled ~65% of a phone's stage. */
export function factoryFrame(aspect: number, cx: number, margin = 1.08, portrait = aspect < 1, bay = 0) {
  // Look more nearly along a portrait floor's length: its machinery gets more screen area
  // while the same corner-fit calculation still protects the dock and expansion bounds.
  const direction = new THREE.Vector3(portrait ? 0.22 : 0.9, 1.2, 1).normalize();
  const fov = 38;
  const corners: THREE.Vector3[] = [];
  const east = EAST + cx * 2;
  const box = (x0: number, x1: number, top: number) => {
    for (const x of [x0, x1]) for (const y of [FLOOR_Y, top]) for (const z of [NORTH, SOUTH]) {
      corners.push(portrait ? new THREE.Vector3(z, y, -x) : new THREE.Vector3(x, y, z));
    }
  };
  box(WEST, east - bay, TOP_Y);
  if (bay > 0) box(east - bay, east, BAY_TOP);
  const { target, position } = fitCentred(corners, direction, fov, aspect, { margin, pivotY: 0.8 });
  return { target, position, fov, corners };
}
