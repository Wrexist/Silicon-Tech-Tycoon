// Icon generator: rasterizes the source icon into the PNG sizes iOS/PWA need + the App Store master.
// SOURCE PRIORITY: if `resources/icon-source.png` exists (a hand-made / AI-rendered 1024² artwork),
// it is used for every output; otherwise it falls back to the parametric `public/icon.svg` mark.
// To swap the app icon: drop your square PNG at resources/icon-source.png and run `npm run assets:icons`.
// iOS ignores SVG icons, so we ship real PNGs. Prefers `sharp`; falls back to `@resvg/resvg-js`.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const svgPath = resolve(root, "public/icon.svg");
const rasterSourcePath = resolve(root, "resources/icon-source.png");
const pub = (name) => resolve(root, "public", name);

// name, pixel size, whether to inset for a maskable safe area (10% padding on a solid bg)
const targets = [
  { name: "icon-192.png", size: 192, maskable: false },
  { name: "icon-512.png", size: 512, maskable: false },
  { name: "icon-512-maskable.png", size: 512, maskable: true },
  { name: "apple-touch-icon-180.png", size: 180, maskable: false },
];

const BG = "#0f1115";

async function withSharp(src, isRaster) {
  const sharp = (await import("sharp")).default;
  for (const t of targets) {
    if (t.maskable) {
      // Render the art at 80% and center it on a solid bg so the safe zone is respected.
      const inner = Math.round(t.size * 0.8);
      const art = await sharp(src).resize(inner, inner).png().toBuffer();
      const pad = Math.round((t.size - inner) / 2);
      await sharp({
        create: { width: t.size, height: t.size, channels: 4, background: BG },
      })
        .composite([{ input: art, top: pad, left: pad }])
        .png()
        .toFile(pub(t.name));
    } else {
      // From a raster source, flatten onto the dark bg so PWA/touch icons are opaque (iOS shows
      // black through transparency on home-screen icons). The SVG path keeps its transparent corners.
      const base = sharp(src).resize(t.size, t.size);
      await (isRaster ? base.flatten({ background: BG }) : base).png().toFile(pub(t.name));
    }
    console.log("wrote", t.name);
  }

  // App Store / native master: 1024×1024, FULL-BLEED, OPAQUE (no alpha, no rounded corners — iOS
  // applies the mask). Flattening onto the app's own dark bg makes rounded corners read as a
  // seamless square. `npx @capacitor/assets generate --ios` consumes this to emit the AppIcon set.
  await mkdir(resolve(root, "resources"), { recursive: true });
  await sharp(src)
    .resize(1024, 1024)
    .flatten({ background: BG })
    .png()
    .toFile(resolve(root, "resources/icon.png"));
  console.log("wrote resources/icon.png (1024, opaque master)");
}

async function withResvg(svg) {
  const { Resvg } = await import("@resvg/resvg-js");
  for (const t of targets) {
    if (t.maskable) {
      // resvg can't composite; render the whole icon (it already has a solid rounded bg).
      const r = new Resvg(svg, { fitTo: { mode: "width", value: t.size } });
      await writeFile(pub(t.name), r.render().asPng());
    } else {
      const r = new Resvg(svg, { fitTo: { mode: "width", value: t.size } });
      await writeFile(pub(t.name), r.render().asPng());
    }
    console.log("wrote", t.name);
  }
}

const useRaster = existsSync(rasterSourcePath);
const src = await readFile(useRaster ? rasterSourcePath : svgPath);
console.log(useRaster ? "source: resources/icon-source.png (raster)" : "source: public/icon.svg (parametric)");
try {
  await withSharp(src, useRaster);
} catch (e) {
  if (useRaster) throw e; // a raster source needs sharp; resvg only rasterizes SVG
  console.warn("sharp unavailable, trying @resvg/resvg-js:", e.message);
  await withResvg(src);
}
console.log("done");
