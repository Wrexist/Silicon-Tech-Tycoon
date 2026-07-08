// Raw review screenshots of the features added this session (NOT marketing frames). Loads the
// new-features staging save, walks to each new surface, and writes a clean PNG per feature.
//   npx vite preview --port 5199 &
//   node scripts/.newfeat.cjs                 # writes /tmp/silicon-newfeat.json
//   node scripts/shots-new-features.mjs
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const URL = process.env.SHOTS_URL || "http://localhost:5199";
const EXE = process.env.SHOTS_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const outDir = resolve(root, ".newfeat-shots");
await mkdir(outDir, { recursive: true });

let staged = (await readFile("/tmp/silicon-newfeat.json")).toString();
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

const shot = async (n) => { await p.waitForTimeout(400); await p.screenshot({ path: resolve(outDir, `${n}.png`) }); console.log("shot", n); };
const tab = async (label) => {
  await p.evaluate((l) => {
    const btn = [...document.querySelectorAll(".bnav__item")].find((el) => el.querySelector(".bnav__label")?.textContent?.trim() === l);
    btn?.click();
  }, label);
  await p.waitForTimeout(1400);
};
const scrollTo = async (sel) => { await p.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: "center" }), sel).catch(() => {}); await p.waitForTimeout(500); };

// 1) HQ — the rolling Contract board (incl. a claimable goal) + unified fans formatting.
await tab("Office");
await scrollTo(".hq__contracts");
await shot("1-hq-contracts");

// 2) Market → Demand → a rival profile showing the merger asset-inheritance preview.
await tab("Market");
await p.evaluate(() => { const b = [...document.querySelectorAll(".mkt__subtab")].find((x) => /demand/i.test(x.textContent || "")); b?.click(); });
await p.waitForTimeout(900);
{
  const rivals = await p.$$(".mkt__rival--btn");
  console.log("rival cards found:", rivals.length);
  let done = false;
  for (let i = 0; i < rivals.length && !done; i++) {
    await rivals[i].click().catch(() => {});
    await p.waitForTimeout(700);
    const note = await p.$('.rprof__acquire-note');
    const txt = note ? (await note.innerText()) : "(no .rprof__acquire-note)";
    console.log(`rival ${i}: ${txt.slice(0, 90)}`);
    if (note && /inherit|patents/i.test(txt)) {
      await scrollTo(".rprof__acquire-note");
      await shot("2-market-merger");
      done = true;
    }
    await p.click('.rprof button:has-text("Done")', { timeout: 1500 }).catch(() => p.keyboard.press("Escape").catch(() => {}));
    await p.waitForTimeout(500);
  }
  if (!done) console.log("!! no acquirable rival found for merger shot");
}

// 3) Market → Products → a product with unmet demand → open the Restock panel.
await tab("Market");
await p.evaluate(() => { const b = [...document.querySelectorAll(".mkt__subtab")].find((x) => /products/i.test(x.textContent || "")); b?.click(); });
await p.waitForTimeout(900);
{
  const products = await p.$$(".mkt__product");
  let done = false;
  for (let i = 0; i < products.length && !done; i++) {
    await products[i].click().catch(() => {});
    await p.waitForTimeout(700);
    const trigger = await p.$('.pd__pricecut-trigger:has-text("Restock")');
    if (trigger) {
      await trigger.click().catch(() => {});           // expand the restock panel
      await p.waitForTimeout(500);
      await scrollTo('.pd__pricecut-panel');
      await shot("3-market-restock");
      done = true;
    }
    await p.click('.pd button:has-text("Done"), .ds-sheet__grab', { timeout: 1200 }).catch(() => p.keyboard.press("Escape").catch(() => {}));
    await p.waitForTimeout(500);
  }
  if (!done) console.log("!! no restockable product found");
}

// 4) Design Lab — the wizard (context for the new category subsystems / archetypes).
await tab("Design");
await p.waitForTimeout(900);
await shot("4-design-lab");

// 5) Design Lab — a non-phone category's NEW signature subsystem (Monitor → "Colour Accuracy",
// which lives in the 3rd wizard tab, labelled "Specs" for a camera-less device).
await p.evaluate(() => { const b = [...document.querySelectorAll(".lab__chip")].find((x) => /monitor/i.test(x.textContent || "")); b?.click(); });
await p.waitForTimeout(700);
await p.evaluate(() => { const t = [...document.querySelectorAll(".lab__tab")].find((x) => /specs/i.test(x.textContent || "")); t?.click(); });
await p.waitForTimeout(800);
await p.locator("text=Colour Accuracy").first().scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => console.log("!! Colour Accuracy subsystem not found"));
await p.waitForTimeout(500);
await shot("5-design-subsystem");

await browser.close();
console.log("done");
