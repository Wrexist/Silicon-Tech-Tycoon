// Self-contained review screenshots of the staff growth-moment interrupt. Serves ./dist in-process,
// stages the rich base save (/tmp/silicon-stage.json) with a pending growth moment for a senior hire,
// captures the decision card, then clicks an option to capture the reveal.
//   npm run shots:stage && node scripts/shoot-staffmoment.mjs
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname, normalize } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(root, "dist");
const PORT = Number(process.env.SHOTS_PORT || 5241);
const EXE = process.env.SHOTS_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const outDir = resolve(root, ".newfeat-shots");
await mkdir(outDir, { recursive: true });

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon" };
const indexFile = resolve(distDir, "index.html");
const server = createServer(async (req, res) => {
  try {
    const p = decodeURIComponent((req.url || "/").split("?")[0]);
    const candidate = p === "/" ? indexFile : resolve(distDir, "." + normalize(p));
    if (!candidate.startsWith(distDir)) { res.writeHead(403); return res.end(); }
    let file = candidate, body;
    try { body = await readFile(candidate); } catch { file = indexFile; body = await readFile(indexFile); }
    res.writeHead(200, { "content-type": MIME[extname(file)] || "text/html" });
    res.end(body);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise((r) => server.listen(PORT, r));
const URL = `http://localhost:${PORT}`;

const save = JSON.parse((await readFile("/tmp/silicon-stage.json")).toString());
const target = save.staff.find((s) => s.id !== "s0") || save.staff[0];
save.pendingStaffMoment = {
  week: save.week, staffId: target.id, staffName: target.name, role: target.role, skill: target.skill,
  options: [
    { kind: "specialty", label: "Battery mastery", blurb: "Cross-trains into Battery — a second stat they lift on Design.", specialty: "battery" },
    { kind: "trait", label: "Visionary streak", blurb: "Also adds extra hype to every launch.", trait: "visionary" },
    { kind: "mentor", label: "Team mentor", blurb: "Mentors the whole team — +12% weekly XP for everyone else." },
  ],
};
// Clear anything higher-priority so the growth card is what shows.
for (const k of ["pendingStrike", "pendingRivalry", "pendingEureka", "pendingCommunityAsk", "pendingEarnings", "pendingAwards", "pendingPoach", "pendingChoice"]) save[k] = null;
save.ready = [];
save.lastActive = Date.now();
const staged = JSON.stringify(save);

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
async function shoot(theme, tag) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((v) => {
    localStorage.setItem("silicon.save.v1", v);
    localStorage.setItem("silicon.settings", JSON.stringify({ theme: window.__THEME || "light", sound: false, haptics: false, garage3d: true, decorateTutorialSeen: true, factoryTutorialSeen: true }));
  }, staged);
  await ctx.addInitScript((t) => { window.__THEME = t; }, theme);
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForTimeout(2600);
  for (let i = 0; i < 8; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.click().catch(() => {}); await p.waitForTimeout(150); }
  await p.waitForSelector(".stfm__card", { timeout: 6000 }).catch(() => console.log("!! staff moment card not found"));
  await p.waitForTimeout(400);
  await p.screenshot({ path: resolve(outDir, `${tag}-decision.png`) });
  console.log("shot", `${tag}-decision`);
  // Click the mentor option → reveal.
  const clicked = await p.evaluate(() => {
    const btns = [...document.querySelectorAll(".stfm__choice")];
    const m = btns.find((b) => /mentor/i.test(b.textContent || "")) || btns[btns.length - 1];
    if (m) { m.click(); return true; }
    return false;
  });
  if (clicked) { await p.waitForTimeout(600); await p.screenshot({ path: resolve(outDir, `${tag}-reveal.png`) }); console.log("shot", `${tag}-reveal`); }
  await ctx.close();
}
await shoot("light", "30-staff-light");
await shoot("dark", "31-staff-dark");
await browser.close();
server.close();
console.log("done");
