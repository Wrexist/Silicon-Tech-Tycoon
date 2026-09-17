// Frame-by-frame PNG comparison for the screenshot harness.
//
//   node scripts/shots-pixel-diff.mjs <baselineDir> <candidateDir> [--threshold N] [--accept N]
//
// --threshold (default 8) is the per-channel absolute difference above which a pixel counts as
// changed. --accept (default 0) is how many changed pixels a frame may have and still pass.
//
// Honest tolerance: DOM-only screens are pixel-stable, so they must run at --accept 0 and come
// out byte-identical. Frames that contain the animated 3D office scene are not stable even
// between two identical builds — SwiftShader dithering and frame timing move a handful of
// pixels — so those runs pass a deliberately small non-zero budget. A budget only ever proves
// "no more than N pixels moved"; it can NOT prove a layout change is fine. Any frame reporting
// a non-zero diff (however small) must be judged by READING the PNG, not by this exit code.
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : Number(args[i + 1]);
};
const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
const [baselineDir, candidateDir] = positional;
if (!baselineDir || !candidateDir) {
  console.error("usage: node scripts/shots-pixel-diff.mjs <baselineDir> <candidateDir> [--threshold N] [--accept N]");
  process.exit(2);
}
const threshold = opt("--threshold", 8);
const accept = opt("--accept", 0);
for (const [label, dir] of [["baseline", baselineDir], ["candidate", candidateDir]]) {
  if (!existsSync(dir)) { console.error(`FAIL: ${label} directory not found: ${dir}`); process.exit(1); }
}

const ls = async (dir) => (await readdir(dir)).filter((f) => f.toLowerCase().endsWith(".png")).sort();
const frames = await ls(baselineDir);
const candidates = new Set(await ls(candidateDir));
const raw = (file) => sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

let failures = 0;
let identical = 0;
console.log(`threshold=${threshold}  accept<=${accept} changed px/frame`);
for (const name of frames) {
  if (!candidates.has(name)) { console.log(`MISSING  ${name}  (no such frame in candidate)`); failures++; continue; }
  const [a, b] = await Promise.all([readFile(join(baselineDir, name)), readFile(join(candidateDir, name))]);
  if (a.equals(b)) { console.log(`IDENTICAL  ${name}`); identical++; continue; }
  const [ra, rb] = await Promise.all([raw(join(baselineDir, name)), raw(join(candidateDir, name))]);
  if (ra.info.width !== rb.info.width || ra.info.height !== rb.info.height) {
    console.log(`FAIL  ${name}  size ${ra.info.width}x${ra.info.height} -> ${rb.info.width}x${rb.info.height}`);
    failures++;
    continue;
  }
  const ch = ra.info.channels;
  let changed = 0, maxDelta = 0;
  for (let i = 0; i < ra.data.length; i += ch) {
    let d = 0;
    for (let c = 0; c < ch; c++) d = Math.max(d, Math.abs(ra.data[i + c] - rb.data[i + c]));
    if (d > maxDelta) maxDelta = d;
    if (d > threshold) changed++;
  }
  const ok = changed <= accept;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  differing=${changed} (accept<=${accept})  maxDelta=${maxDelta}`);
}
console.log(`\n${failures ? "FAIL" : "PASS"}: ${frames.length} frames, ${identical} byte-identical, ${failures} failed.`);
process.exit(failures ? 1 : 0);
