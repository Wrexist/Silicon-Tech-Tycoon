# App Store creative assets — Header & Search Results

The new App Store Connect **Header and Search Results** assets (Asset Library), built from the real game UI.

| File | Placement | Canvas | Format |
|---|---|---|---|
| `header-3840x1646.png` | Product page **Header** | 3840 × 1646 (21:9) | PNG, opaque RGB |
| `search-3840x2560.png` | **Search Results** | 3840 × 2560 (3:2) | PNG, opaque RGB |

Both are Apple's max resolution and have no alpha channel, which App Store Connect requires.

**Design.** Dark brand gradient (`#0f1115` → `#161a22`), `#3b82f6` accent glow, and a faint circuit grid.
The HQ capture is the centred hero, with Design Lab, Market, Research and Company fanned out to each side.
Focal content stays in the centre so Apple's per-device crops only trim the outer phones.
- **Header:** no text. Apple's guidance is "a single clear idea", and the product page already shows the name and icon.
- **Search Results:** "State the obvious". Headline *Build a tech empire* plus *Design devices · Build the factory · Beat every rival*.

**Rules checked.** The assets are suitable for a 4+ rating. They contain no prices, discounts, URLs, ©, awards, other-platform logos or real brands.
All company names in the captures are fictional, and the dollar figures are in-game.

## Upload
App Store Connect → your app → **Header and Search Results**.
1. **Header** → *Browse Assets* → upload `header-3840x1646.png`.
2. **Search Results** → upload `search-3840x2560.png`.

Use **Preview** to check iPhone and iPad in light and dark, then submit them with the next version.

## Regenerate
`node appstore/creative-assets/render.mjs`. This needs Playwright and ImageMagick. In cloud sessions, set `CHROMIUM=/opt/pw-browsers/chromium`.
Edit `compose.html` to change the layout, and swap captures in `appstore/screenshots/raw/` to change the art.
The search-results copy is English. For other locales, duplicate it with translated text.
