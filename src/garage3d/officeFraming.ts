import * as THREE from 'three';
import { fitCentred } from './cameraFit.ts';
import { GRID, gridN } from '../engine/furniture.ts';

// The office card's resting camera, fitted to the card instead of one hand-tuned pose for every
// screen. The LOOK stays the long-standing 3/4 view from the open front-right corner (azimuth
// ~41.5°, ~29° above the floor); only where the pivot sits and how far back the camera stands are
// fitted, per card aspect and facility tier. One room in both themes (the garage), so the theme
// never changes the fit.

/** Unit vector from the pivot towards the camera — the cozy view's fixed direction. */
export const OFFICE_VIEW = new THREE.Vector3(15.5, 13, 17.5).normalize();
export const OFFICE_FOV = 25;
const PIVOT_Y = 0.25;
// The room is a wide diamond from this corner, so a squarish phone card lets the far left/right
// tips of the floor run off the sides (the old hand-tuned pose cropped them by 10–20% too) rather
// than shrinking the whole room into a band. Height is never cropped: the back wall's top and the
// floor's front tip stay in. The standing walls' far ends are not in the box at all — an interior
// wall running out of frame reads as a room; a shrunken room reads as a toy.
const SIDE_CROP = 0.85;
// Breathing room on the tight axis — the era tag and Edit button float over the card's top corners.
const MARGIN = 1.06;

/** What the cozy view must show: the placeable grid, furniture height at its side tips, the top of
 *  the back corner where the two standing walls meet (−x, −z), and the floor plate's front tip. */
export function officeCorners(facilityTier: number): THREE.Vector3[] {
  const k = gridN(facilityTier) / GRID.n; // the shell's x/z scale (heights don't scale)
  const half = (gridN(facilityTier) * GRID.cell) / 2;
  const wall = 4.2 * k;
  // The garage walls run to 5.2 m — keep the lit brand sign, let the bare upper wall crop.
  const wallTop = 3.5;
  const tip = 4.3 * k;
  return [
    new THREE.Vector3(-half, 0, half), new THREE.Vector3(half, 0, -half), new THREE.Vector3(half, 0, half),
    new THREE.Vector3(-half, 1.6, half), new THREE.Vector3(half, 1.6, -half),
    new THREE.Vector3(-wall, wallTop, -wall),
    new THREE.Vector3(tip, -0.5, tip),
  ];
}

export function officeFrame(aspect: number, facilityTier: number) {
  const corners = officeCorners(facilityTier);
  const { target, position } = fitCentred(corners, OFFICE_VIEW, OFFICE_FOV, aspect, { margin: MARGIN, crop: SIDE_CROP, pivotY: PIVOT_Y });
  return { target, position, corners };
}
