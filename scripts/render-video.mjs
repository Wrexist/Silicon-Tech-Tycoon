// Marketing video renderer — drives marketing/video/animation.html frame-by-frame and encodes each
// scenario to a clean vertical (1080×1920) webm B-roll clip in marketing/video/. The clips are
// deliberately text-light so you can add a voiceover / captions over them; see marketing/VIDEO_SCRIPTS.md
// for the matching viral hooks. A logo + App Store end card closes each one.
//
//   node scripts/render-video.mjs            # all clips
//   node scripts/render-video.mjs climb      # a single clip by id
//
// Output is MP4 (H.264) when an ffmpeg with libx264 is available — a system ffmpeg, $FFMPEG, or the
// npm `@ffmpeg-installer/ffmpeg` binary (install with `npm i -D @ffmpeg-installer/ffmpeg`). If only
// Playwright's bundled ffmpeg is found it falls back to VP8/webm (convert later with any editor).
import { mkdir } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stage = pathToFileURL(resolve(root, "marketing/video/animation.html")).href;
const outDir = resolve(root, "marketing/video");
const FPS = 30, W = 1080, H = 1920;
const shot = (n) => `../assets/_device/${n}.png`;

// ── scenarios ────────────────────────────────────────────────────────────────
// clip.kb = [scale0, scale1, x0%, x1%, y0%, y1%] Ken-Burns move; objPos frames the shot.
const SCENARIOS = [
  { id: "make-launch-win", accent: "#3b82f6", xfade: 0.5,
    clips: [
      { src: shot("design"),  dur: 3.4, kb: [1.05,1.14,  0, 0,  2,-3], objPos: "50% 16%" },
      { src: shot("factory"), dur: 3.0, kb: [1.14,1.04,  3,-2,  0, 0], objPos: "50% 42%" },
      { src: shot("market"),  dur: 3.2, kb: [1.03,1.13,  0, 0,  4,-2], objPos: "50% 20%" },
    ], endcard: { dur: 2.2 } },
  { id: "climb", accent: "#3b82f6", xfade: 0.5,
    clips: [ { src: shot("market"), dur: 7.0, kb: [1.00,1.14, 0,1.5, 6,-4], objPos: "50% 20%" } ],
    endcard: { dur: 1.6 } },
  { id: "factory", accent: "#f59e0b", xfade: 0.5,
    clips: [ { src: shot("factory"), dur: 7.0, kb: [1.05,1.13, -3,3, 0,0], objPos: "50% 42%" } ],
    endcard: { dur: 1.6 } },
  { id: "empire", accent: "#8b5cf6", xfade: 0.5,
    clips: [ { src: shot("office"), dur: 7.0, kb: [1.02,1.16, 0,0, 6,-2], objPos: "50% 42%" } ],
    endcard: { dur: 1.6 } },
  { id: "awards", accent: "#d9a824", xfade: 0.5,
    clips: [ { src: shot("awards"), dur: 7.0, kb: [1.14,1.02, 0,0, -2,2], objPos: "50% 30%" } ],
    endcard: { dur: 1.6 } },
];

// ── tool resolution ──────────────────────────────────────────────────────────
let chromium;
try { ({ chromium } = await import("playwright")); }
catch { try { ({ chromium } = await import("playwright-core")); }
  catch { console.error("Playwright not found: npm i -D playwright"); process.exit(1); } }
function resolveChrome() {
  if (process.env.SHOTS_CHROME) return process.env.SHOTS_CHROME;
  const base = "/opt/pw-browsers";
  if (existsSync(base)) { const d = readdirSync(base).filter((x)=>/^chromium-\d+$/.test(x)).sort().pop();
    const e = d && resolve(base, d, "chrome-linux/chrome"); if (e && existsSync(e)) return e; }
  return undefined;
}
const hasX264 = (bin) => { try { return /libx264/.test(spawnSync(bin, ["-hide_banner","-encoders"], { encoding:"utf8" }).stdout || ""); } catch { return false; } };
async function installerFfmpeg() { try { return (await import("@ffmpeg-installer/ffmpeg")).default.path; } catch { return null; } }
function bundledFfmpeg() {
  const base = "/opt/pw-browsers";
  if (existsSync(base)) { const d = readdirSync(base).filter((x)=>/^ffmpeg/.test(x)).sort().pop();
    const e = d && resolve(base, d, "ffmpeg-linux"); if (e && existsSync(e)) return e; }
  return "ffmpeg";
}
// Prefer an H.264-capable ffmpeg (→ .mp4 for TikTok). Fall back to the bundled VP8 build (→ .webm).
async function resolveEncoder() {
  const cands = [process.env.FFMPEG, "ffmpeg", await installerFfmpeg()].filter(Boolean);
  for (const bin of cands) if (hasX264(bin)) return { bin, mp4: true };
  return { bin: bundledFfmpeg(), mp4: false };
}
const ENC = await resolveEncoder();
const EXT = ENC.mp4 ? "mp4" : "webm";

function encode(frames, outPath) {
  const vargs = ENC.mp4
    ? ["-c:v","libx264", "-crf","17", "-preset","slow", "-pix_fmt","yuv420p", "-movflags","+faststart"]
    : ["-c:v","libvpx", "-b:v","12M", "-deadline","good", "-cpu-used","1", "-auto-alt-ref","0", "-pix_fmt","yuv420p"];
  return new Promise((res, rej) => {
    const ff = spawn(ENC.bin, ["-y", "-f","image2pipe", "-vcodec","mjpeg", "-framerate", String(FPS), "-i", "pipe:0",
      ...vargs, outPath], { stdio:["pipe","ignore","inherit"] });
    ff.on("error", rej);
    ff.on("close", (c) => c === 0 ? res() : rej(new Error("ffmpeg exit "+c)));
    (async () => { for (const f of frames) { if (!ff.stdin.write(f)) await new Promise(r=>ff.stdin.once("drain",r)); } ff.stdin.end(); })();
  });
}

// ── render ───────────────────────────────────────────────────────────────────
await mkdir(outDir, { recursive: true });
const only = process.argv[2];
const browser = await chromium.launch({ executablePath: resolveChrome() });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.goto(stage, { waitUntil: "networkidle" });
const stageEl = await page.$("#stage");

for (const scn of SCENARIOS) {
  if (only && scn.id !== only) continue;
  await page.evaluate((s) => setScenario(s), scn);
  await page.evaluate((paths) => preload(paths), [...new Set(scn.clips.map(c=>c.src))]);
  const total = await page.evaluate(() => window.__totalDuration());
  const n = Math.ceil(total * FPS);
  process.stdout.write(`\n${scn.id}: ${total.toFixed(1)}s · ${n} frames `);
  const frames = [];
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => renderFrame(t), i / FPS);
    frames.push(await stageEl.screenshot({ type: "jpeg", quality: 82 }));
    if (i % 30 === 0) process.stdout.write(".");
  }
  await encode(frames, resolve(outDir, `silicon-${scn.id}-1080x1920.${EXT}`));
  process.stdout.write(" ✓");
}
await browser.close();
console.log("\nRendered clips → marketing/video/");
