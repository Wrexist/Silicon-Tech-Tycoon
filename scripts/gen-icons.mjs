// One-off icon generator: rasterizes public/icon.svg into the PNG sizes iOS/PWA need.
// iOS ignores SVG icons, so we ship real PNGs. Run: `node scripts/gen-icons.mjs`.
// Prefers `sharp`; falls back to `@resvg/resvg-js` if sharp isn't installed.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const svgPath = resolve(root, "public/icon.svg");
const pub = (name) => resolve(root, "public", name);

// name, pixel size, whether to inset for a maskable safe area (10% padding on a solid bg)
const targets = [
  { name: "icon-192.png", size: 192, maskable: false },
  { name: "icon-512.png", size: 512, maskable: false },
  { name: "icon-512-maskable.png", size: 512, maskable: true },
  { name: "apple-touch-icon-180.png", size: 180, maskable: false },
];

const BG = "#0f1115";

async function withSharp(svg) {
  const sharp = (await import("sharp")).default;
  for (const t of targets) {
    if (t.maskable) {
      // Render the art at 80% and center it on a solid bg so the safe zone is respected.
      const inner = Math.round(t.size * 0.8);
      const art = await sharp(svg).resize(inner, inner).png().toBuffer();
      const pad = Math.round((t.size - inner) / 2);
      await sharp({
        create: {
          width: t.size,
          height: t.size,
          channels: 4,
          background: BG,
        },
      })
        .composite([{ input: art, top: pad, left: pad }])
        .png()
        .toFile(pub(t.name));
    } else {
      await sharp(svg).resize(t.size, t.size).png().toFile(pub(t.name));
    }
    console.log("wrote", t.name);
  }
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

const svg = await readFile(svgPath);
try {
  await withSharp(svg);
} catch (e) {
  console.warn("sharp unavailable, trying @resvg/resvg-js:", e.message);
  await withResvg(svg);
}
console.log("done");
