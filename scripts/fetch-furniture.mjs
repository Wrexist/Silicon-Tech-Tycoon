#!/usr/bin/env node
// Fetch the Kenney "Furniture Kit" (CC0) and place matched .glb models into public/furniture/.
//
//   npm run furniture:fetch          # auto-discovers the current download link
//   KENNEY_URL=https://... npm run furniture:fetch   # or pass an explicit .zip URL
//
// The kit is CC0 (public domain) — free to ship, no attribution required. Models that match our
// catalog are copied to public/furniture/<id>.glb (the ids in src/garage3d/furnitureModels.ts).
// Anything that can't be found is skipped — the app falls back to its parametric piece, so a
// partial fetch never breaks the build. Re-run any time; it overwrites cleanly.
import { execFileSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, rm, copyFile, writeFile, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TMP = path.join(ROOT, ".furniture-tmp");
const OUT = path.join(ROOT, "public", "furniture");
const PAGE = "https://kenney.nl/assets/furniture-kit";

// our id  ->  candidate Kenney .glb basenames (first match wins; case-insensitive)
const MAP = {
  desk: ["desk"],
  deskL: ["deskCorner"],
  chair: ["chairDesk", "chairModernCushion", "chair"],
  armchair: ["loungeDesignChair", "chairModernFrameCushion", "loungeChair"],
  loungeChair: ["loungeChair", "loungeDesignChair"],
  sofa: ["loungeSofa", "loungeDesignSofa"],
  sofaL: ["loungeSofaCorner", "loungeDesignSofaCorner"],
  stool: ["stoolBar", "stoolBarSquare"],
  coffeeTable: ["tableCoffee", "tableCoffeeGlass"],
  meetingTable: ["table", "tableCloth"],
  sideTable: ["sideTable", "sideTableDrawers"],
  bookshelf: ["bookcaseOpen", "bookcaseOpenLow"],
  cabinet: ["bookcaseClosedWide", "bookcaseClosed"],
  shelfUnit: ["bookcaseOpenLow", "bookcaseOpen"],
  crates: ["cardboardBoxClosed", "cardboardBoxOpen"],
  plantTall: ["pottedPlant"],
  plantPot: ["plantSmall1", "plantSmall", "houseplant"],
  rug: ["rugRectangle"],
  rugRound: ["rugRounded", "rugRound"],
  tvStand: ["cabinetTelevision", "cabinetTelevisionDoors"],
  floorLamp: ["lampSquareFloor", "lampRoundFloor"],
  arcLamp: ["lampRoundFloor", "lampSquareFloor"],
  lantern: ["lampRoundTable", "lampSquareTable"],
};

const log = (...a) => console.log("[furniture]", ...a);

async function discoverZipUrl() {
  if (process.env.KENNEY_URL) return process.env.KENNEY_URL;
  log(`discovering download link from ${PAGE} …`);
  const html = await (await fetch(PAGE, { redirect: "follow" })).text();
  // look for any .zip link referencing the kit (relative or absolute)
  const rx = /(?:href|content|src)=["']([^"']*furniture-kit[^"']*\.zip)["']/i;
  let m = html.match(rx);
  if (!m) m = html.match(/["']([^"']*\/media\/[^"']*\.zip)["']/i);
  if (!m) throw new Error("could not find a .zip link on the Kenney page — pass KENNEY_URL=… explicitly");
  let url = m[1];
  if (url.startsWith("//")) url = "https:" + url;
  else if (url.startsWith("/")) url = "https://kenney.nl" + url;
  return url;
}

async function download(url, dest) {
  log(`downloading ${url}`);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`download failed: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  const { size } = await stat(dest);
  log(`saved ${(size / 1e6).toFixed(1)} MB`);
}

function extract(zip, dest) {
  log("extracting …");
  if (process.platform === "win32") {
    execFileSync("powershell", ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${dest}' -Force`], { stdio: "inherit" });
  } else {
    execFileSync("unzip", ["-o", "-q", zip, "-d", dest], { stdio: "inherit" });
  }
}

async function walkGlb(dir, acc = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walkGlb(p, acc);
    else if (e.name.toLowerCase().endsWith(".glb")) acc.push(p);
  }
  return acc;
}

async function main() {
  await rm(TMP, { recursive: true, force: true });
  await mkdir(TMP, { recursive: true });
  await mkdir(OUT, { recursive: true });

  const url = await discoverZipUrl();
  const zip = path.join(TMP, "kit.zip");
  await download(url, zip);
  extract(zip, TMP);

  const glbs = await walkGlb(TMP);
  log(`found ${glbs.length} .glb files in the kit`);
  const byBase = new Map();
  for (const f of glbs) byBase.set(path.basename(f, ".glb").toLowerCase(), f);

  const placed = [];
  const missing = [];
  for (const [id, candidates] of Object.entries(MAP)) {
    const hit = candidates.map((c) => c.toLowerCase()).find((c) => byBase.has(c));
    if (!hit) { missing.push(id); continue; }
    await copyFile(byBase.get(hit), path.join(OUT, `${id}.glb`));
    placed.push({ id, source: path.basename(byBase.get(hit)) });
  }

  await writeFile(path.join(OUT, "_manifest.json"), JSON.stringify({ source: url, placed, missing }, null, 2));
  await rm(TMP, { recursive: true, force: true });

  log(`✓ placed ${placed.length} models in public/furniture/`);
  placed.forEach((p) => log(`   ${p.id}  ←  ${p.source}`));
  if (missing.length) log(`(no match — staying parametric: ${missing.join(", ")})`);
  log("done — reload the app and open the office to see the models.");
}

main().catch((err) => {
  console.error("[furniture] failed:", err.message);
  console.error("[furniture] the app still works (parametric fallback). You can also download the");
  console.error("[furniture] Kenney Furniture Kit manually from https://kenney.nl/assets/furniture-kit");
  console.error("[furniture] and unzip the .glb files into public/furniture/ as <id>.glb.");
  process.exit(1);
});
