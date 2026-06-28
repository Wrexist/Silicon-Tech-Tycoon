// Robot character model registry — the drop-in seam for 3D characters.
//
// The SHIPPED DEFAULT is the hand-built parametric robot (rounded body + glowing eyes), which
// matches the clean mascot aesthetic — no .glb is active out of the box. `models/base.glb` is an
// INACTIVE CC0 sample ("RobotExpressive" by Tomás Laulhé / Don McCurdy, from the three.js
// examples; Idle/Sitting/Walking/Wave clips built in) kept in the repo so enabling models needs
// no hunting:
//
//  - Rename it to `robot_shared.glb` → ONE model is used for every robot, tinted per colour slot
//    (the "Main" body material takes ROBOT_COLORS[i]; eyes/joints stay intact — see gltfRobot).
//  - Or drop per-colour files: robot_blue.glb / robot_orange.glb / robot_green.glb /
//    robot_purple.glb / robot_yellow.glb — each keeps its NATIVE colours (no tint) and overrides
//    the shared model for that slot.
//
// Files auto-register via import.meta.glob — no code edits. Free .glb sources: poly.pizza,
// Quaternius, Kenney.nl, Sketchfab (free + downloadable filter). Export .glb — NOT .usdz (that's
// native SceneKit; won't load). Any colour with no file falls back to the parametric robot.

export interface RobotAsset {
  url: string;
  /** Optional hex applied to the model's "Main" body material (used to colour the shared model). */
  tint?: string;
}

/** The five office accent colours, by slot. Single source of truth — the 3D scene's parametric
 *  robots, desk dots, and the shared-model tint all read these. */
export const ROBOT_COLORS = ["#4a9af5", "#ff7a35", "#40c870", "#9060e8", "#f5c840"] as const;

// Auto-discovered model files — nothing is bundled until a robot_*.glb actually exists.
const robotFiles = import.meta.glob("./models/robot_*.glb", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

// Colour index order must match ROBOT_COLORS above.
const COLOR_ORDER = ["blue", "orange", "green", "purple", "yellow"] as const;

const byColor: Record<string, string> = {};
let sharedUrl: string | undefined;
for (const [path, url] of Object.entries(robotFiles)) {
  const m = path.match(/robot_([a-z]+)\.glb$/i);
  if (!m) continue;
  if (m[1].toLowerCase() === "shared") sharedUrl = url;
  else byColor[m[1].toLowerCase()] = url;
}

/** Resolve a colour slot to a model: a per-colour .glb if present (native colours kept), else the
 *  shared .glb tinted to the slot's ROBOT_COLORS hue, else undefined → the parametric robot. */
export function robotModelFor(colorIdx: number): RobotAsset | undefined {
  const n = COLOR_ORDER.length;
  const i = ((colorIdx % n) + n) % n;
  const name = COLOR_ORDER[i];
  if (byColor[name]) return { url: byColor[name] };
  if (sharedUrl) return { url: sharedUrl, tint: ROBOT_COLORS[i] };
  return undefined;
}
