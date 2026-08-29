// Sound — a tiny synthesized UI sound set via the Web Audio API. Zero asset files, fully
// mutable. Subtle and premium, never cartoonish. Respects the user's sound setting.
import { getSettings } from "../state/settings.ts";

let ctx: AudioContext | null = null;

// A cue must NEVER be able to take the game down. `sfx()` is called from ordinary handlers but also
// from inside the weekly tick (a commission delivering, a shortlist arriving), and constructing an
// AudioContext genuinely throws: browsers cap the number of live contexts per page (as few as four on
// some Safari builds) and reject the constructor outright when audio hardware is unavailable. Thrown
// from the tick, that killed the sim — the failure mode a missing beep should never have. Every entry
// point into the Web Audio API here is therefore guarded, and a failure degrades to silence, which is
// the same outcome the `sound` setting already produces and which nothing else depends on.
let audioFailed = false;

function ac(): AudioContext | null {
  if (typeof window === "undefined" || audioFailed) return null;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    // iOS uses "interrupted" (phone call / Siri), not just "suspended" — resume on ANY
    // non-running state or post-interruption cues stay silent forever.
    if (ctx.state !== "running") void ctx.resume();
    return ctx;
  } catch {
    // Latch it: without this every later cue re-attempts the same failing construction, so a
    // fast-forwarded run would pay the cost of a throw several times a second.
    audioFailed = true;
    ctx = null;
    return null;
  }
}

// iOS only unlocks audio from a user gesture; the first cue can be tick-driven (e.g. a build
// finishing), which would create the context outside a gesture and leave it suspended. Warm it
// up on the first pointer so every later cue — gesture-driven or not — can play.
if (typeof window !== "undefined") {
  const warmup = () => {
    try {
      ac();
    } catch {
      /* audio unavailable — cues simply stay silent */
    }
  };
  window.addEventListener("pointerdown", warmup, { once: true, passive: true });
}

interface ToneSpec {
  freq: number;
  to?: number; // glide target
  dur: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}

function tone(spec: ToneSpec) {
  // Second half of the "a cue can never crash the game" contract above: even with a live context, the
  // node graph calls can throw (a context torn down by the OS mid-cue, an out-of-range ramp value).
  // Silence is always the right answer here, so nothing from the audio graph escapes into a caller —
  // several of which are on the weekly tick.
  try {
    play(spec);
  } catch {
    /* cue dropped — silence is not a failure worth propagating */
  }
}

function play({ freq, to, dur, type = "sine", gain = 0.12, delay = 0 }: ToneSpec) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.012, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function chord(freqs: number[], dur: number, opts: Partial<ToneSpec> = {}) {
  freqs.forEach((f, i) => tone({ freq: f, dur, gain: 0.08, type: "triangle", delay: i * 0.05, ...opts }));
}

type Cue =
  | "tap"
  | "confirm"
  | "toggle"
  | "launch"
  | "hit"
  | "build"
  | "levelup"
  | "upgrade"
  | "cash"
  | "rp"
  | "era"
  | "mastery"
  | "star"
  | "challenge"
  | "bankrupt"
  | "error";

export function sfx(cue: Cue): void {
  if (!getSettings().sound) return;
  switch (cue) {
    case "tap":
      tone({ freq: 420, dur: 0.05, type: "sine", gain: 0.06 });
      break;
    case "toggle":
      tone({ freq: 520, to: 660, dur: 0.07, type: "sine", gain: 0.07 });
      break;
    case "confirm":
      tone({ freq: 587, to: 784, dur: 0.12, type: "triangle", gain: 0.1 });
      break;
    case "launch":
      tone({ freq: 180, to: 720, dur: 0.5, type: "sawtooth", gain: 0.09 });
      tone({ freq: 360, to: 1440, dur: 0.5, type: "sine", gain: 0.05, delay: 0.02 });
      break;
    case "hit":
      chord([523, 659, 784, 1047], 0.5, { type: "triangle", gain: 0.09 });
      break;
    case "build":
      tone({ freq: 392, to: 523, dur: 0.16, type: "triangle", gain: 0.09 });
      break;
    case "levelup":
      chord([659, 880, 1109], 0.3, { type: "sine", gain: 0.07 });
      break;
    case "upgrade":
      // Something REAL was installed: a weighty mechanical thunk, then a bright rising
      // sparkle that lands on a major-chord shimmer. Bigger than levelup, shorter than era.
      tone({ freq: 196, to: 147, dur: 0.09, type: "triangle", gain: 0.11 });
      tone({ freq: 523, to: 784, dur: 0.14, type: "sine", gain: 0.07, delay: 0.07 });
      chord([784, 988, 1175], 0.35, { type: "triangle", gain: 0.06, delay: 0.18 });
      break;
    case "cash":
      tone({ freq: 880, dur: 0.05, type: "square", gain: 0.04 });
      tone({ freq: 1320, dur: 0.07, type: "square", gain: 0.035, delay: 0.05 });
      break;
    case "rp":
      tone({ freq: 740, to: 988, dur: 0.1, type: "sine", gain: 0.05 });
      break;
    case "era":
      chord([392, 523, 659, 784], 0.6, { type: "triangle", gain: 0.08 });
      break;
    case "mastery":
      // A big earned win (achievement unlock, awards sweep, eureka jackpot, moonshot landing):
      // a quick ascending arpeggio that resolves into a bright major chord. Between levelup
      // (smaller) and era (bigger) — a real "you did it".
      tone({ freq: 523, dur: 0.1, type: "triangle", gain: 0.08 });
      tone({ freq: 659, dur: 0.1, type: "triangle", gain: 0.08, delay: 0.08 });
      tone({ freq: 784, dur: 0.1, type: "triangle", gain: 0.08, delay: 0.16 });
      chord([1047, 1319, 1568], 0.4, { type: "sine", gain: 0.07, delay: 0.24 });
      break;
    case "star":
      // A scenario star lands on the shelf: a high glittering twinkle — two quick pings that
      // ring out into a bright sine shimmer. Lighter and sparklier than mastery; unmistakably
      // "a star", not a generic fanfare.
      tone({ freq: 1047, to: 1319, dur: 0.08, type: "sine", gain: 0.07 });
      tone({ freq: 1568, dur: 0.09, type: "sine", gain: 0.06, delay: 0.09 });
      chord([1319, 1568, 2093], 0.35, { type: "sine", gain: 0.05, delay: 0.17 });
      break;
    case "challenge":
      // Daily/weekly challenge complete: a proud two-beat "medal pinned" fanfare — a low root,
      // a step up, then a wide warm chord. Weightier than levelup, rounder than mastery's ladder.
      tone({ freq: 330, dur: 0.09, type: "triangle", gain: 0.1 });
      tone({ freq: 494, dur: 0.1, type: "triangle", gain: 0.09, delay: 0.09 });
      chord([587, 740, 880, 1175], 0.45, { type: "triangle", gain: 0.07, delay: 0.19 });
      break;
    case "bankrupt":
      tone({ freq: 300, to: 90, dur: 0.7, type: "sawtooth", gain: 0.1 });
      break;
    case "error":
      tone({ freq: 200, to: 150, dur: 0.18, type: "square", gain: 0.08 });
      break;
  }
}
