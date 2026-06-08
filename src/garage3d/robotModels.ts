// Robot character model registry — the drop-in seam for 3D characters.
//
// SHIPS BY DEFAULT with a free CC0 rigged robot (`models/base.glb` — "RobotExpressive" by
// Tomás Laulhé / Don McCurdy, CC0, from the three.js examples). It has Idle/Sitting/Walking/Wave
// animations built in. We render it for all five office colours by tinting its body material
// ("Main") per colour — eyes/joints (Grey/Black) stay intact. No accounts, no cost, no Mac.
//
// WANT DISTINCT MODELS PER COLOUR? Drop `.glb` files into src/garage3d/models/ named
// robot_blue.glb / robot_orange.glb / robot_green.glb / robot_purple.glb / robot_yellow.glb and
// they auto-register (via import.meta.glob) and override the tinted base for that colour — no
// code edits. Free model sources that need no payment: poly.pizza, Quaternius, Kenney.nl,
// Sketchfab (free + downloadable filter), or AI generators with free tiers (Tripo3D, Hugging
// Face TripoSR/InstantMesh spaces). Export .glb — NOT .usdz (that's native SceneKit; won't load).
//
// Any colour with no file and no base falls back to the hand-built parametric robot.

export interface RobotAsset {
  url: string;
  /** Optional hex applied to the model's "Main" body material (used to colour the shared base). */
  tint?: string;
}

// Per-colour overrides — auto-discovered, none committed by default (so nothing is bundled
// until you add a file). models/base.glb is a CC0 sample you can rename to robot_blue.glb etc.
const colorFiles = import.meta.glob("./models/robot_*.glb", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

// Colour index order must match ROBOT_COLORS in Garage3D.tsx.
const COLOR_ORDER = ["blue", "orange", "green", "purple", "yellow"] as const;

const byColor: Record<string, string> = {};
for (const [path, url] of Object.entries(colorFiles)) {
  const m = path.match(/robot_([a-z]+)\.glb$/i);
  if (m) byColor[m[1].toLowerCase()] = url;
}

/** Resolve a colour index to a model: a dropped-in per-colour .glb if present, else undefined.
 *  Undefined → the hand-built parametric robot (rounded body + glowing eyes), which matches the
 *  clean mascot aesthetic. Drop in robot_<colour>.glb (or rename the bundled base.glb sample)
 *  to override a colour with your own model. */
export function robotModelFor(colorIdx: number): RobotAsset | undefined {
  const n = COLOR_ORDER.length;
  const name = COLOR_ORDER[((colorIdx % n) + n) % n];
  if (byColor[name]) return { url: byColor[name] };
  return undefined;
}

/** True when at least one per-colour robot model has been dropped in. */
export const HAS_ROBOT_MODELS = Object.keys(byColor).length > 0;
