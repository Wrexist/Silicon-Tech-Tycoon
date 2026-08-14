// Lossless PNG recompression for every image the app ships — the web icons, the App Store master,
// and the iOS asset catalog.
//
// Why this exists: `gen-icons.mjs` and `npx @capacitor/assets generate` both write PNGs with sharp's
// DEFAULT encoder settings, which optimize for speed, not size. The results were dramatic — an
// 11.25 MB image payload where 2.84 MB carries the identical pixels. The iOS splash screens alone
// were 1.3 MB each (×3 slots in the imageset), and the App Store icon master 1.5 MB. All of that
// ships inside the .ipa, so it was pure download weight on every install.
//
// LOSSLESS IS ENFORCED, NOT ASSUMED. Every rewrite is verified by decoding both the original and the
// candidate to raw pixels and comparing them byte for byte. If a single pixel differs, the file is
// left alone and the run fails. That check earned its keep immediately: sharp turns `palette` ON by
// default the moment you pass `effort` or `quality`, so the obvious first attempt at "just compress
// harder" was quietly quantizing every gradient (max channel delta 28/255 on the app icon) while
// reporting twice the savings. Hence the explicit `palette: false` below — and the verifier that
// would have caught it even if nobody had read the docs.
//
// There is no quality knob here on purpose. These are the assets a player judges the app by before
// they have played it — the icon on their home screen, the splash before first paint — and buying
// another 30% by banding a gradient is not a trade this app should make.
//
// One transformation IS applied beyond recompression: a fully-opaque alpha channel is dropped. That
// is lossless by definition (every pixel is α=255), it is what Apple REQUIRES of an app icon, and it
// is what a maskable PWA icon wants anyway. A channel carrying real transparency is never touched.
//
// Run with `npm run assets:optimize`. Idempotent — a second run finds nothing to do.
import sharp from "sharp";
import { readdir, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Where shipped images live. `resources/` holds the App Store masters, `ios/` the asset catalog. */
const ROOTS = ["public", "resources", "ios"];
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "Pods", "build", "DerivedData"]);

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // a root that doesn't exist in this checkout (e.g. no ios/ on a web-only clone)
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) yield* walk(p);
    } else if (/\.png$/i.test(e.name)) {
      yield p;
    }
  }
}

/** Decode to raw RGBA pixels so two encodings can be compared for true visual identity. */
async function pixels(input) {
  return sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

let totalBefore = 0;
let totalAfter = 0;
let rewritten = 0;
let failures = 0;

for (const r of ROOTS) {
  for await (const path of walk(resolve(root, r))) {
    const rel = relative(root, path);
    const originalSize = (await stat(path)).size;
    totalBefore += originalSize;

    const meta = await sharp(path).metadata();
    const stats = await sharp(path).stats();
    // Only ever drop an alpha channel that carries no information.
    const dropAlpha = meta.hasAlpha && stats.isOpaque;

    let pipeline = sharp(path);
    if (dropAlpha) pipeline = pipeline.removeAlpha();
    const candidate = await pipeline
      .png({
        // `palette: false` is load-bearing — see the header note. Everything else here is a pure
        // encoder choice that cannot change a pixel: maximum zlib effort, and per-scanline adaptive
        // filtering (which is where most of the win actually comes from on smooth gradients).
        palette: false,
        compressionLevel: 9,
        adaptiveFiltering: true,
      })
      .toBuffer();

    if (candidate.length >= originalSize) {
      totalAfter += originalSize;
      continue; // already optimal — leave it exactly as it is
    }

    // The lossless proof: identical dimensions, identical pixels.
    const [before, after] = await Promise.all([pixels(path), pixels(candidate)]);
    const same =
      before.info.width === after.info.width &&
      before.info.height === after.info.height &&
      before.data.equals(after.data);

    if (!same) {
      console.error(`  MISMATCH, left untouched: ${rel}`);
      totalAfter += originalSize;
      failures++;
      continue;
    }

    await writeFile(path, candidate);
    totalAfter += candidate.length;
    rewritten++;
    const pct = Math.round((1 - candidate.length / originalSize) * 100);
    console.log(
      `  ${String(Math.round(originalSize / 1024)).padStart(5)}K -> ${String(Math.round(candidate.length / 1024)).padStart(5)}K  (-${String(pct).padStart(2)}%)${dropAlpha ? "  [dropped opaque alpha]" : ""}  ${rel}`,
    );
  }
}

const mb = (n) => (n / 1048576).toFixed(2);
console.log(
  `\n${rewritten} file${rewritten === 1 ? "" : "s"} rewritten. ${mb(totalBefore)} MB -> ${mb(totalAfter)} MB (saved ${mb(totalBefore - totalAfter)} MB).`,
);
if (failures > 0) {
  console.error(`${failures} file(s) could not be verified lossless and were left untouched.`);
  process.exit(1);
}
