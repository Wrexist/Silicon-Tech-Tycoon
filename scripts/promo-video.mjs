// App Store / ad promo recorder. Records ONE continuous portrait promo of live gameplay with hype
// text overlays baked in — brand intro → living office → design → factory → the perfect launch
// ("It's a hit!" + confetti) → the team celebrates → #1 empire → end card. Boot is hidden behind a
// full-bleed brand cover that fades to reveal the game. The app shell caps at 420px, so we CSS-zoom
// the whole page to fill a crisp 1080×2340 frame, then time-compress the take to ~29s.
//   npm run build && npm run preview -- --port 5200 &
//   node scripts/stage-promo-video.mjs           # → /tmp/silicon-promo.json
//   SHOTS_URL=http://localhost:5200 node scripts/promo-video.mjs
//   → /tmp/silicon-promo-vid/Silicon-TechTycoon-promo.webm  (1080×2340, ~29s)
import { mkdir, readFile, readdir, rename, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright-core";

const URL = process.env.SHOTS_URL || "http://localhost:5200";
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const FFMPEG = process.env.SHOTS_FFMPEG || "/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux";
const TARGET_SECS = Number(process.env.PROMO_TARGET_SECS || 29);   // final promo length
// Render at the app's NATIVE width (#root caps at 540px) with NO CSS zoom — a prior zoom trick
// mis-measured the 3D office canvas and cropped it. We record at 540×1170, then upscale 2× to a
// crisp 1080×2340 HD portrait during the final ffmpeg pass.
const W = 540, H = 1170;
const OUT_W = 1080, OUT_H = 2340;
const outDir = "/tmp/silicon-promo-vid";
await mkdir(outDir, { recursive: true });

const save = JSON.parse((await readFile("/tmp/silicon-promo.json")).toString());
const saveJson = JSON.stringify({ ...save, lastActive: Date.now() });

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: 1,
  recordVideo: { dir: outDir, size: { width: W, height: H } },
});
await ctx.addInitScript((v) => {
  localStorage.setItem("silicon.save.v1", v);
  localStorage.setItem("silicon.settings", JSON.stringify({ theme: "dark", sound: false, haptics: false, garage3d: true, decorateTutorialSeen: true, factoryTutorialSeen: true }));
  localStorage.setItem("silicon.hint.tapteam", "1");
  localStorage.setItem("silicon.factory.camhint", "1");
}, saveJson);
const p = await ctx.newPage();

const wait = (ms) => p.waitForTimeout(ms);

async function installStage() {
  await p.evaluate(() => {
    const s = document.createElement("style");
    s.textContent = `
      #promo-cover{position:fixed;inset:0;z-index:99998;display:flex;flex-direction:column;align-items:center;justify-content:center;
        background:radial-gradient(120% 90% at 50% 20%,#1b2a4a 0%,#0b1120 55%,#060912 100%);transition:opacity .8s ease;font-family:system-ui,-apple-system,sans-serif}
      #promo-cover.hide{opacity:0;pointer-events:none}
      #promo-cover .chip{width:82px;height:82px;border-radius:22px;display:flex;align-items:center;justify-content:center;margin-bottom:24px;
        background:linear-gradient(160deg,#3b82f6,#1e40af);box-shadow:0 10px 40px rgba(59,130,246,.55);animation:ppop .8s cubic-bezier(.2,.9,.2,1) both}
      #promo-cover .chip svg{width:44px;height:44px;color:#fff}
      #promo-cover .k{font-size:82px;font-weight:900;letter-spacing:-2px;line-height:.92;
        background:linear-gradient(180deg,#eaf1ff,#9dbcff 72%,#5b8bff);-webkit-background-clip:text;background-clip:text;color:transparent;
        filter:drop-shadow(0 6px 30px rgba(70,120,255,.45));animation:ppop .8s .05s cubic-bezier(.2,.9,.2,1) both}
      #promo-cover .s{margin-top:10px;font-size:22px;font-weight:800;letter-spacing:8px;color:#9db4e8;text-transform:uppercase;animation:pfade .9s .18s both}
      #promo-cover .t{margin-top:26px;font-size:20px;font-weight:600;color:#c7d6f5;opacity:.92;animation:pfade .9s .36s both}
      #promo-scrim{position:fixed;left:0;right:0;bottom:0;height:300px;z-index:99996;pointer-events:none;opacity:0;transition:opacity .45s ease;
        background:linear-gradient(180deg,transparent,rgba(4,7,14,.62) 46%,rgba(4,7,14,.9))}
      #promo-scrim.on{opacity:1}
      #promo-ovl{position:fixed;left:0;right:0;z-index:99997;display:flex;justify-content:center;pointer-events:none;padding:0 30px;font-family:system-ui,-apple-system,sans-serif}
      #promo-ovl .card{max-width:100%;text-align:center}
      #promo-ovl .ey{font-size:16px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#7fd0ff;filter:drop-shadow(0 2px 12px rgba(0,0,0,.7));animation:prise .55s cubic-bezier(.2,.9,.2,1) both}
      #promo-ovl .hd{margin-top:7px;font-size:42px;font-weight:900;letter-spacing:-1px;line-height:1.04;color:#fff;
        text-shadow:0 4px 26px rgba(0,0,0,.9),0 1px 0 rgba(0,0,0,.6);animation:prise .55s .06s cubic-bezier(.2,.9,.2,1) both}
      #promo-ovl.out{opacity:0;transition:opacity .4s ease}
      @keyframes prise{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
      @keyframes pfade{from{opacity:0}to{opacity:1}}
      @keyframes ppop{from{opacity:0;transform:translateY(22px) scale(.94)}to{opacity:1;transform:translateY(0) scale(1)}}
    `;
    document.head.appendChild(s);
    const cover = document.createElement("div");
    cover.id = "promo-cover";
    cover.innerHTML = `<div class="chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/></svg></div><div class="k">SILICON</div><div class="s">Tech Tycoon</div><div class="t">Build the empire behind every device.</div>`;
    document.body.appendChild(cover);
    const scrim = document.createElement("div");
    scrim.id = "promo-scrim";
    document.body.appendChild(scrim);
    const ovl = document.createElement("div");
    ovl.id = "promo-ovl"; ovl.style.display = "none";
    ovl.innerHTML = `<div class="card"><div class="ey"></div><div class="hd"></div></div>`;
    document.body.appendChild(ovl);
  });
}
const hideCover = () => p.evaluate(() => document.getElementById("promo-cover")?.classList.add("hide"));
const endCard = (tagline) => p.evaluate((t) => {
  const c = document.getElementById("promo-cover");
  if (c) { c.querySelector(".t").textContent = t; c.classList.remove("hide"); }
}, tagline);
async function caption(eyebrow, headline, pos = "bottom") {
  await p.evaluate(({ eyebrow, headline, pos }) => {
    const o = document.getElementById("promo-ovl");
    const scrim = document.getElementById("promo-scrim");
    if (!o) return;
    o.classList.remove("out");
    o.style.display = "flex";
    if (pos === "mid") { o.style.top = "40%"; o.style.bottom = "auto"; scrim?.classList.remove("on"); }
    else { o.style.bottom = "96px"; o.style.top = "auto"; scrim?.classList.add("on"); }   // lower third + scrim
    o.querySelector(".ey").textContent = eyebrow || "";
    o.querySelector(".hd").textContent = headline || "";
    o.querySelectorAll(".ey,.hd").forEach((el) => { el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; });
  }, { eyebrow, headline, pos });
}
const clearCaption = () => p.evaluate(() => {
  const o = document.getElementById("promo-ovl");
  document.getElementById("promo-scrim")?.classList.remove("on");
  if (o) { o.classList.add("out"); setTimeout(() => (o.style.display = "none"), 420); }
});

async function nav(label) {
  await p.evaluate((lbl) => {
    const b = [...document.querySelectorAll("nav button")].find((x) => (x.textContent || "").toLowerCase().includes(lbl));
    b?.click();
  }, label.toLowerCase());
  await wait(120);
}
async function clickText(text, { exact = false, sel = "button" } = {}) {
  return await p.evaluate(({ text, exact, sel }) => {
    const t = text.toLowerCase();
    const b = [...document.querySelectorAll(sel)].find((x) => {
      const s = (x.textContent || "").trim().toLowerCase();
      return exact ? s === t : s.includes(t);
    });
    if (b) { b.click(); return true; } return false;
  }, { text, exact, sel });
}
async function pauseSim() {
  for (let i = 0; i < 3; i++) {
    const label = await p.evaluate(() => {
      const b = document.querySelector('[aria-label="Pause"]');
      if (b) { b.click(); return "clicked"; }
      return document.querySelector('[aria-label="Resume"]') ? "already" : "none";
    });
    await wait(200);
    if (label === "already") return true;
  }
  return await p.evaluate(() => !!document.querySelector('[aria-label="Resume"]'));
}

// ---------------- boot (hidden behind the cover) ----------------
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
await installStage();
await wait(400);
await p.click('.ds-sheet button:has-text("Continue")', { timeout: 1200 }).catch(() => {});
for (let i = 0; i < 8; i++) { const sk = await p.$(".coach__skip"); if (!sk) break; await sk.click().catch(() => {}); await wait(140); }
await nav("office");
await wait(400);
await pauseSim();
// Hide desktop-only look-around hint so the mobile promo stays clean.
await p.addStyleTag({ content: ".hq__camhint{display:none!important}" });
await p.evaluate(() => { [...document.querySelectorAll("*")].forEach((el) => { if (el.children.length === 0 && /WASD to look around/i.test(el.textContent || "")) el.style.visibility = "hidden"; }); });
await wait(1000);   // let the 3D office settle behind the cover

// ================= SCENE 1 — brand intro =================
await wait(800);
await hideCover();
await wait(550);

// ================= SCENE 2 — living office =================
await caption("A world that reacts", "Run a studio that's alive");
await wait(2000);
await clearCaption();
await wait(200);

// ================= SCENE 3 — design =================
await nav("design");
await wait(600);
await caption("Design", "Craft iconic devices");
await wait(1100);
await p.mouse.wheel(0, 560); await wait(1500);
await clearCaption();
await p.mouse.wheel(0, -560); await wait(220);

// ================= SCENE 4 — factory (live preview of the decorated line) =================
await nav("office");
await wait(350);
await clickText("Factory");                                  // Office/Factory segmented toggle → live minimap
await wait(1300);                                            // let the 3D preview settle (belts roll, truck)
await caption("Manufacture", "Build it on your own line");
await wait(2400);
await clearCaption();
await wait(220);
await clickText("Office");                                   // back to the office world for the launch
await wait(900);

// ================= SCENE 5 — the perfect launch =================
await caption("Launch", "Ship the perfect device");
await wait(1300);
await clearCaption();
await wait(220);
await clickText("Launch", { exact: true });                 // Rocket · Launch on the Office ready card
// The keynote reveal owns the screen — score counts in, then the verdict + confetti. Let it play
// and breathe; the card literally reads "It's a hit!", so no competing caption over it.
await wait(5200);

// ================= SCENE 6 — the team celebrates =================
await clickText("Continue", { sel: ".lreveal__card button" });   // close reveal → office cheer fires
await wait(450);
await caption("Every win lands", "Your whole team celebrates");
await wait(2300);                                          // HQ_REACTION_MS window — emotes + hops
await clearCaption();
await wait(200);

// ================= SCENE 7 — the empire / close =================
await nav("market");
await wait(700);
await caption("Rise to #1", "Build a billion-dollar empire");
await wait(1900);
await clearCaption();
await wait(200);
await endCard("Coming to iPhone & iPad.");
await wait(1800);

await ctx.close();   // flushes the video
await browser.close();

// Pick the take we just recorded by modification time (newest), not alphabetically — the dir may
// hold leftovers from earlier runs. Fail loudly if nothing was written.
const webms = (await readdir(outDir)).filter((f) => f.endsWith(".webm") && f !== "silicon-promo.webm" && f !== "Silicon-TechTycoon-promo.webm");
if (webms.length === 0) { console.error("No recorded .webm found in", outDir); process.exit(1); }
const timed = await Promise.all(webms.map(async (f) => ({ f, t: (await stat(`${outDir}/${f}`)).mtimeMs })));
timed.sort((a, b) => a.t - b.t);
const finalPath = `${outDir}/silicon-promo.webm`;
await rename(`${outDir}/${timed[timed.length - 1].f}`, finalPath);

// Probe the raw duration so we can time-compress to exactly ~TARGET_SECS. -itsscale rewrites input
// timestamps; combined with a scale filter it retimes AND upscales to HD in one re-encode pass.
const probe = spawnSync(FFMPEG, ["-i", finalPath], { encoding: "utf8" });
const m = (probe.stderr || "").match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
if (!m) { console.error("ffmpeg could not probe duration (bad FFMPEG path or corrupt take?):\n", probe.stderr || probe.error); process.exit(1); }
const raw = +m[1] * 3600 + +m[2] * 60 + +m[3];
const scale = Math.min(1, TARGET_SECS / raw);
const outPath = `${outDir}/Silicon-TechTycoon-promo.webm`;
const enc = spawnSync(FFMPEG, [
  "-itsscale", scale.toFixed(4), "-i", finalPath,
  "-vf", `scale=${OUT_W}:${OUT_H}:flags=lanczos`,
  "-c:v", "libvpx", "-b:v", "3M", "-crf", "8", outPath, "-y",
], { encoding: "utf8" });
if (enc.status !== 0) { console.error("ffmpeg encode failed:", enc.stderr || enc.stdout || enc.error); process.exit(1); }
console.log("RAW", finalPath, `${raw.toFixed(1)}s @ ${W}x${H}`);
console.log("VIDEO", outPath, `~${(raw * scale).toFixed(1)}s @ ${OUT_W}x${OUT_H}`);
