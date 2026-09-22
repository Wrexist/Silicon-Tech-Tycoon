// Deterministic "water-cooler" chatter for the 3D office (Wave 7). Each bubble is a small rounded
// panel drawn at runtime to a canvas — no image file, no font file, no texture asset — billboarded
// to face the camera above a speaker's head.
//
// Scheduling is a DERIVED hash of (seed, week, slot) — never Math.random — so the same week resolves
// to the same speakers and the same lines and a capture is repeatable. Bubbles are consumed at most
// two per slot and fade in/out. The component pulls no frames of its own: it animates inside the
// scene's existing render loop, which the host pauses to "demand" when the office is off-screen or
// the sim is paused, so a hidden office can never be kept awake by a bubble.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { cosmeticHash01, officeSeed, officeWeek, workTargetFor } from "./officeLive.ts";
import { poseFor, type Activity } from "./employeeController.ts";

export interface Speaker {
  key: string;
  x: number;
  z: number;
  y?: number;
  /** The character's robot seed — the fallback work-state key before the robot publishes a pose. */
  seed?: number;
}

/** Every line belongs to a state, so a bubble can never claim something the character isn't doing.
 *  The activity itself is published by whichever component animates the character (seated robot or
 *  walker); this layer only chooses the wording. Authored, brand-free, emoji-free, kept short. */
const LINES_BY_ACTIVITY: Record<Activity, readonly string[]> = {
  working: ["Working…", "Shipping…", "Compiling…", "Testing…"],
  thinking: ["Thinking…"],
  walking: ["On my way…", "Be right back…"],
  coffee: ["Coffee…", "Refuel…"],
  arcade: ["One more…"],
  board: ["Planning…"],
  relaxing: ["Taking a break", "Recharging"],
  watering: ["Watering plants"],
};

const MAX = 2;            // concurrent bubbles cap — a few at most
const SLOT_SECONDS = 5.4; // one slot of chatter about every five seconds
const LIFE_SECONDS = 3.4; // how long a bubble stays up
const FADE_IN = 0.35;
const FADE_OUT = 0.6;
const BUBBLE_W = 1.15;
const BUBBLE_H = 0.467;   // matches the 512×208 canvas aspect

// Scene-constant ink/paper, matching the existing label pills (theme-independent, so a bubble reads
// in both app themes). These are canvas colours, not UI CSS — the design-token rule governs CSS.
const BUBBLE_BG = "rgba(255,255,255,0.96)";
const BUBBLE_EDGE = "rgba(26,29,35,0.16)";
const BUBBLE_INK = "#1a1d23";

/** Draw one bubble (rounded panel + tail + centred text) into a canvas → texture. Cached per line. */
function bubbleTexture(line: string): THREE.CanvasTexture {
  const W = 512, H = 208;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const ctx = c.getContext("2d");
  if (!ctx) return tex; // a null 2D context must not throw mid-render (same guard as WallTV)
  const pad = 10;
  const tail = 20;
  const r = 44;
  const x = pad, y = pad, w = W - pad * 2, h = H - pad * 2 - tail;
  const panel = () => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  ctx.clearRect(0, 0, W, H);
  panel();
  ctx.fillStyle = BUBBLE_BG;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = BUBBLE_EDGE;
  ctx.stroke();
  // Tail — a small wedge pointing down-left toward the speaker.
  ctx.beginPath();
  const cx = W * 0.34;
  ctx.moveTo(cx - 20, y + h - 3);
  ctx.lineTo(cx + 10, y + h - 3);
  ctx.lineTo(cx - 14, y + h + tail - 3);
  ctx.closePath();
  ctx.fillStyle = BUBBLE_BG;
  ctx.fill();
  ctx.strokeStyle = BUBBLE_EDGE;
  ctx.stroke();
  ctx.fillStyle = BUBBLE_INK;
  ctx.font = "600 46px -apple-system, 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(line, W / 2, y + h / 2);
  tex.needsUpdate = true;
  return tex;
}

const texCache = new Map<string, THREE.CanvasTexture>();
function textureFor(line: string): THREE.CanvasTexture {
  let t = texCache.get(line);
  if (!t) {
    t = bubbleTexture(line);
    texCache.set(line, t);
  }
  return t;
}

interface ActiveBubble {
  key: string;
  activity: Activity;
  line: string;
  born: number;
  x: number;
  z: number;
  y: number;
  jitter: number;
  /** Set when the speaker's state no longer matches the line — the bubble is cleared, not replaced. */
  gone?: boolean;
}

/** Pure: which bubbles a slot shows, chosen from the derived hash. `slot` is folded into the week
 *  argument so each slot is an independent stream; salts 419/421/433/439 keep the picks decorrelated.
 *  The LINE comes from the speaker's live activity — the same pose the animation uses. */
function slotBubbles(speakers: Speaker[], seed: number, week: number, slot: number): ActiveBubble[] {
  if (speakers.length === 0) return [];
  const key = week * 4096 + (slot & 4095);
  const out: ActiveBubble[] = [];
  const count = cosmeticHash01(seed, key, 419) < 0.55 ? 2 : 1;
  for (let i = 0; i < Math.min(count, MAX); i++) {
    const sp = speakers[Math.floor(cosmeticHash01(seed, key, 421 + i * 7) * speakers.length) % speakers.length];
    const pose = poseFor(sp.key);
    const activity: Activity =
      pose?.activity ??
      (sp.seed !== undefined && workTargetFor(officeSeed(), week, Math.round(sp.seed * 1000)) === 1 ? "working" : "thinking");
    const pool = LINES_BY_ACTIVITY[activity];
    const line = pool[Math.floor(cosmeticHash01(seed, key, 433 + i * 7) * pool.length) % pool.length];
    const jitter = (cosmeticHash01(seed, key, 439 + i * 7) - 0.5) * 0.34;
    out.push({ key: sp.key, activity, line, born: slot * SLOT_SECONDS + i * 0.5, x: pose?.x ?? sp.x, z: pose?.z ?? sp.z, y: sp.y ?? 2.35, jitter });
  }
  return out;
}

/** The bubble layer. Parent gates it on `!reduceMotion && officeChatter` — it renders nothing then. */
export default function SpeechBubbles({ speakers, paused = false }: { speakers: Speaker[]; paused?: boolean }) {
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const active = useRef<ActiveBubble[]>([]);
  const slotRef = useRef(-1);
  const weekRef = useRef(-1);
  const acc = useRef(0);
  // Seconds of ACTIVE play only (office live AND the sim not held). This is what drives the slot.
  // Unlike the render clock it never jumps when the office remounts from `demand`, and it stops
  // dead while a pause/overlay holds the game — so the chatter freezes with the sim.
  const activeTime = useRef(0);
  const scratch = useMemo(() => new THREE.Quaternion(), []);

  useFrame((st, dt) => {
    if (paused) {
      // Held (manual pause, an interrupt overlay, or the office off-screen): show nothing and forget
      // the current slot. `activeTime` is deliberately left unchanged, so the schedule resumes from
      // where it stopped instead of racing ahead behind the overlay.
      slotRef.current = -1;
      for (let i = 0; i < MAX; i++) if (meshes.current[i]) meshes.current[i]!.visible = false;
      return;
    }
    // HONEST TRADE-OFF: bubble CONTENT (which character, which line) is a derived hash of
    // (seed, weekIndex, index); bubble TIMING advances with active play time, because pinning it to
    // the sim would require a sim tick counter this render layer does not receive. Exact
    // cross-session timing is not a goal for cosmetic chatter — freezing with the sim is — so two
    // sessions can show the chatter on different seconds.
    activeTime.current += dt;
    // Throttle to ~20fps: flavour, not gameplay. The billboard is re-aimed at the same cadence.
    acc.current += dt;
    if (acc.current < 1 / 20) return;
    acc.current = 0;
    const t = activeTime.current;
    const slot = Math.floor(t / SLOT_SECONDS);
    const wk = officeWeek();
    // A new week re-rolls who is working, so anything on screen was picked for last week's states:
    // drop the slot and start clean rather than let a stale line speak for the new week.
    if (wk !== weekRef.current) {
      weekRef.current = wk;
      slotRef.current = -1;
      active.current = [];
    }
    if (slot !== slotRef.current) {
      slotRef.current = slot;
      active.current = slotBubbles(speakers, officeSeed(), wk, slot);
    }
    for (let i = 0; i < MAX; i++) {
      const mesh = meshes.current[i];
      const mat = mats.current[i];
      if (!mesh || !mat) continue;
      const b = active.current[i];
      if (!b || b.gone) { mesh.visible = false; continue; }
      const age = t - b.born;
      if (age < 0 || age > LIFE_SECONDS) { mesh.visible = false; continue; }
      // The bubble follows its speaker (a walker moves) and dies if the speaker's state changed —
      // it must never say "Working…" over someone who just walked off to the arcade.
      const pose = poseFor(b.key);
      if (pose) {
        if (pose.activity !== b.activity) { b.gone = true; mesh.visible = false; continue; }
        if (pose.x !== undefined && pose.z !== undefined) { b.x = pose.x; b.z = pose.z; }
      }
      mesh.visible = true;
      mesh.position.set(b.x + b.jitter, b.y, b.z + b.jitter * 0.4);
      scratch.copy(st.camera.quaternion);
      mesh.quaternion.copy(scratch);
      mat.opacity = age < FADE_IN ? age / FADE_IN : age > LIFE_SECONDS - FADE_OUT ? Math.max(0, (LIFE_SECONDS - age) / FADE_OUT) : 1;
      const tex = textureFor(b.line);
      if (mat.map !== tex) {
        mat.map = tex;
        mat.needsUpdate = true;
      }
    }
  });

  return (
    <group>
      {Array.from({ length: MAX }).map((_, i) => (
        <mesh key={i} ref={(el) => { meshes.current[i] = el; }} visible={false} renderOrder={5}>
          <planeGeometry args={[BUBBLE_W, BUBBLE_H]} />
          <meshBasicMaterial ref={(el) => { mats.current[i] = el; }} transparent opacity={0} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
