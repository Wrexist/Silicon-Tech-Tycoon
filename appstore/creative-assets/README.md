# App Store creative assets — Header & Search Results

The App Store Connect **Header and Search Results** assets (Asset Library), made from real in-game 3D renders.

| File | Placement | Canvas | Format |
|---|---|---|---|
| `header-3840x1646.png` | Product page **Header** | 3840 × 1646 (21:9) | PNG, opaque RGB |
| `search-3840x2560.png` | **Search Results** | 3840 × 2560 (3:2) | PNG, opaque RGB |
| `universal-5244x2950.png` | Header **or** Search Results | 5244 × 2950 (16:9) | PNG, opaque RGB |

**Design.** The Office team on the left melts into the Factory line on the right, joined by a beam of brand light.
Both halves are the real scenes, rendered full-bleed from a directed camera (`scripts/trailer/stills.mjs`).
The focal pair sits on the centre line, so Apple's per-device crops only trim the outer edges, and the bottom stays calm for the App Store's own overlay.
- **Header / universal:** no text. The product page already shows the name and icon.
- **Search Results:** *Build your tech empire.* plus *Run the studio. Build the factory. Beat every rival.* on a clear band above the worlds.

**Rules checked.** The assets are suitable for a 4+ rating. They contain no prices, discounts, URLs, ©, awards, other-platform logos or real brands.

## Upload
App Store Connect → your app → **Header and Search Results**.
1. **Header** → *Upload* → `header-3840x1646.png`.
2. **Search Results** → *Upload* → `search-3840x2560.png`.

Use **Preview** to check iPhone and iPad, then submit them with the next version.

## Regenerate
1. Start the dev server: `npx vite --port 5191 --strictPort --host 127.0.0.1`.
2. Stage the save: `npm run shots:stage:showcase`.
3. Render the plates: `node scripts/trailer/stills.mjs` (`PROBE=1` renders candidate camera poses).
4. Compose: `node appstore/creative-assets/render.mjs`.

Plates go to `$TRAILER_OUT` (default `C:/tmp/cine`). Edit `compose.html` for layout, and `POSES` in `stills.mjs` for camera angles.

The App Store preview video uses the same harness: `scripts/trailer/capture.mjs` then `scripts/trailer/compose.mjs`.
