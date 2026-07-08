// Review screenshots of the Living OS. Loads the staged save, opens Company → Platform, and captures
// the App Store + Security console, then triggers the security-update install animation mid-progress.
//   npx vite preview --port 5199 &
//   node scripts/.livingos.cjs                 # writes /tmp/silicon-livingos.json
//   node scripts/shots-living-os.mjs
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const URL = process.env.SHOTS_URL || "http://localhost:5199";
const EXE = process.env.SHOTS_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const outDir = resolve(root, ".newfeat-shots");
await mkdir(outDir, { recursive: true });

let staged = (await readFile("/tmp/silicon-livingos.json")).toString();
{ const sv = JSON.parse(staged); sv.lastActive = Date.now(); staged = JSON.stringify(sv); }

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript((v) => {
  localStorage.setItem("silicon.save.v1", v);
  localStorage.setItem("silicon.settings", JSON.stringify({ theme: "light", sound: false, haptics: false, garage3d: true, decorateTutorialSeen: true, factoryTutorialSeen: true }));
}, staged);
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(2800);
await p.addStyleTag({ content: ".hq__camhint{display:none!important}" }).catch(() => {});
await p.click('.ds-sheet button:has-text("Continue")', { timeout: 2500 }).catch(() => {});
for (let i = 0; i < 8; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.click().catch(() => {}); await p.waitForTimeout(200); }
await p.click('button[aria-label="Pause"]', { timeout: 5000 }).catch(() => {});
await p.waitForTimeout(400);

const shot = async (n) => { await p.waitForTimeout(350); await p.screenshot({ path: resolve(outDir, `${n}.png`) }); console.log("shot", n); };
const tab = async (label) => {
  await p.evaluate((l) => {
    const btn = [...document.querySelectorAll(".bnav__item")].find((el) => el.querySelector(".bnav__label")?.textContent?.trim() === l);
    btn?.click();
  }, label);
  await p.waitForTimeout(1200);
};
const scrollTo = async (sel) => { await p.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: "center" }), sel).catch(() => {}); await p.waitForTimeout(450); };

// Company → Platform sub-tab.
await tab("Company");
await p.evaluate(() => { const b = [...document.querySelectorAll(".co__subtab, .co__nav-item, button")].find((x) => /^platform$/i.test((x.textContent || "").trim())); b?.click(); });
await p.waitForTimeout(1000);

// 1) Security console (threat vs. hardening + the update button).
await scrollTo(".plat__sec");
await shot("6-os-security");

// 2) App Store (catalogue + featured strip + commission).
await scrollTo(".plat__store-strip");
await shot("7-os-appstore");

// 3) The immersive update animation — click "Install security update" and catch it mid-install.
await p.evaluate(() => {
  const btn = [...document.querySelectorAll(".plat__sec ~ * button, button")].find((x) => /install security update/i.test(x.textContent || ""));
  btn?.click();
});
await p.waitForTimeout(650); // mid-progress
await scrollTo(".plat__update");
await shot("8-os-update-installing");

// 4) OS version release update button (scroll up to the OS version card).
await scrollTo(".plat__release-note");
await p.waitForTimeout(300);
await shot("9-os-version");

await browser.close();
console.log("done");
