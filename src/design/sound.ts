// Sound — a tiny synthesized UI sound set via the Web Audio API. Zero asset files, fully
// mutable. Subtle and premium, never cartoonish. Respects the user's sound setting.
import { getSettings } from "../state/settings.ts";

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface ToneSpec {
  freq: number;
  to?: number; // glide target
  dur: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}

function tone({ freq, to, dur, type = "sine", gain = 0.12, delay = 0 }: ToneSpec) {
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
  | "cash"
  | "rp"
  | "era"
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
    case "bankrupt":
      tone({ freq: 300, to: 90, dur: 0.7, type: "sawtooth", gain: 0.1 });
      break;
    case "error":
      tone({ freq: 200, to: 150, dur: 0.18, type: "square", gain: 0.08 });
      break;
  }
}
