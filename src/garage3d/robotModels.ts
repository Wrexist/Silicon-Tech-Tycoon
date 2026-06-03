// Robot character model registry — the drop-in seam for AI-generated 3D characters.
//
// PIPELINE (done on your Mac — this is a headless build env, it can't run these):
//   1. Meshy.ai  — Image-to-3D / Text-to-3D → export each robot as .glb
//      Prompt: "Cute rounded robot, solid <colour> body, small glowing eyes,
//               stubby arms, smooth matte plastic, standing pose, isometric game style"
//   2. Mixamo    — (optional) auto-rig + bake an "Idle" / "Sitting" / "Walking" clip,
//                  re-export as .glb (Format: glTF Binary). Keep materials a single solid colour.
//   3. Drop the files into  src/garage3d/models/  named  robot_<colour>.glb
//        robot_blue.glb  robot_orange.glb  robot_green.glb  robot_purple.glb  robot_yellow.glb
//
// That's it. The glob below auto-discovers whatever is present at build time, so a dropped-in
// file appears in the scene with NO code edits and NO 404s. Any colour without a file keeps the
// hand-built parametric robot (see RobotCharacter in Garage3D.tsx) as an automatic fallback.
//
// USE .glb — NOT .usdz. This is a web/Three.js app (R3F), not native SceneKit. USDZ won't load.

export interface RobotAsset {
  url: string;
}

// Eager URL discovery: returns only files that actually exist, mapped to their fingerprinted
// served URL. Empty when the folder has no models yet → everything falls back to parametric.
const files = import.meta.glob("./models/robot_*.glb", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

// Colour index order must match ROBOT_COLORS in Garage3D.tsx.
const COLOR_ORDER = ["blue", "orange", "green", "purple", "yellow"] as const;

const byColor: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) {
  const m = path.match(/robot_([a-z]+)\.glb$/i);
  if (m) byColor[m[1].toLowerCase()] = url;
}

/** Resolve a colour index to a registered .glb, or undefined to use the parametric fallback. */
export function robotModelFor(colorIdx: number): RobotAsset | undefined {
  const n = COLOR_ORDER.length;
  const name = COLOR_ORDER[((colorIdx % n) + n) % n];
  const url = byColor[name];
  return url ? { url } : undefined;
}

/** True once at least one robot .glb has been dropped in — handy for diagnostics. */
export const HAS_ROBOT_MODELS = Object.keys(byColor).length > 0;
