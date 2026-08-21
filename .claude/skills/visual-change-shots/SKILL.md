---
name: visual-change-shots
description: Use when making any UI, layout, CSS, or screen change in Silicon and the change should be shown to the user visually — captures every primary screen of the built app into before/after PNG sets plus a side-by-side compare page. Also use when a popup "looks wrong" and you need to see it, or after restyling a card to prove nothing else shifted.
---

# Visual change shots

**A UI change that isn't seen isn't verified.** Typecheck proves it compiles; a screenshot proves
it looks right. This repo has a one-command capture harness (`scripts/shots-diff.mjs`) that builds
nothing itself — it shoots the CURRENT `dist/` through a real headless browser (WebGL on, so the 3D
office renders) against an engine-staged thriving-company save.

## The workflow

```bash
# 1. BEFORE touching code: build + capture the baseline.
npm run build
npm run shots:diff -- before

# 2. Make your changes. Then rebuild + capture.
npm run build
npm run shots:diff -- after

# 3. Hand the user the review page (opens their browser):
start .shots/compare.html        # Windows   |  open .shots/compare.html (mac)
```

`compare.html` regenerates on EVERY run: columns = captured labels (oldest → newest), rows = the
10 screens (Office top/end/full-stream, Design, Research, Market top/end, Company, Settings,
Progress). Click any frame for full resolution. Labels are arbitrary — `npm run shots:diff -- ipad`
for a variant, for example.

## What the harness handles for you

- **Staging**: bundles + runs `scripts/stage-save.mjs` through the real engine → era-2 company with
  staff, launches, fans, cash. Screens read as a real mid-game, not a fresh garage. Override with
  `SHOTS_SAVE=<json>` to shoot a specific save.
- **Serving**: runs `vite preview` in-process on port 5199. No second terminal.
- **Browser**: auto-finds Chrome then Edge (Windows/macOS/Linux paths); override with
  `SHOTS_CHROME=<exe>`. Launches with SwiftShader so WebGL/3D works headless.
- **Popups**: dismisses coach/tutorial steps AND any boot-raised interrupt (Vault reveal, awards…)
  via Escape + primary-button fallback, pauses the sim, waits out toasts — frames are steady state.
- **Theme**: pins dark + tutorials-seen so captures are deterministic and comparable.

## Rules

1. **Capture `before` from the pre-change build.** A baseline shot after editing is a lie — rebuild
   reverts nothing. If you forgot, `git stash` → build → shoot → `git stash pop`.
2. **Rebuild between labels.** The tool refuses to run without `dist/index.html`, but it cannot tell
   a fresh dist from a stale one. `npm run build` is part of step 2, not optional.
3. **Read at least one frame yourself** (the Read tool renders images) before telling the user it
   worked — confirm the changed screen actually shows the change and nothing else regressed.
4. **Port 5199 must be free.** A stray preview server holds it; kill it or set `SHOTS_URL`.
5. Output lives in `.shots/` (gitignored) — never commit captures; they're review artifacts.

## Common mistakes

| Symptom | Cause |
|---|---|
| Both columns identical after a "big" CSS change | Forgot `npm run build` before the `after` run |
| Blank/black office frame | Browser launched without WebGL flags — don't bypass the launcher; it injects them |
| Overlay card polluting Office frames | Staged save raised an interrupt; the dismissal pass handles known ones — if a NEW interrupt type appears, extend the Escape/button loop |
| `No Chrome/Edge found` | Set `SHOTS_CHROME` to chrome.exe/msedge.exe explicitly |
| Frames differ in week/cash between labels | Sim wasn't paused — the tool pauses; only bypass its sequence if you replicate pause+settle |

## When NOT to reach for this

Engine/state refactors with zero visual intent (e.g. the F36 context split): tests + typecheck are
the verification; shots should come out pixel-identical, so one quick `after` set as a smoke check
is enough — no `before` needed unless you want the proof pair.
