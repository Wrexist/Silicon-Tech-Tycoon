# App Store localizations — all 39 App Store Connect locales

Copy-paste-ready App Store Connect metadata for every locale ASC supports. English (U.S.)
master lives in `../APP_STORE_METADATA.md`; each folder here is one ASC localization.

## File → App Store Connect field

Each `<locale>/` folder uses fastlane `deliver` naming, so it can be uploaded by hand **or**
automated later with `fastlane deliver` by pointing it at this directory:

| File | ASC field | Limit |
|---|---|---|
| `name.txt` | App Name | 30 |
| `subtitle.txt` | Subtitle | 30 |
| `promotional_text.txt` | Promotional Text | 170 |
| `keywords.txt` | Keywords (comma-separated, no spaces) | 100 |
| `description.txt` | Description | 4000 |
| `release_notes.txt` | What's New | 4000 |
| `screenshot_captions.txt` | Not an ASC field — the 6 caption lines to bake into localized screenshot frames | — |

## Validate before every submit

```
node appstore/localizations/validate.mjs --all
```

Checks Apple's character limits (code-point counting, matches ASC), keyword-field format
(no spaces after commas, no empty slots), emoji, and keyword slots wasted on words already
indexed via that locale's name/subtitle. Must print `✓` for every locale.

## Keyword strategy baked into these files

1. **Name + subtitle + keywords are indexed together** per locale — no word appears twice
   across the three fields of one locale.
2. **Cross-localization indexing** (per ASO-tool reporting) is exploited, not fought:
   - US storefront indexes `en-US` **and** `es-MX` → es-MX carries Spanish terms that rank
     in both the US and Mexico, plus a couple of English reserve-pool terms.
   - Canada indexes `en-CA` + `fr-CA`; Japan `ja` + `en-US`; Korea `ko` + `en-US`; most
     European storefronts index the local language + `en-GB`.
   - Therefore `en-GB`, `en-AU`, `en-CA` keyword fields **complement** `en-US` (reserve-pool
     and adjacent terms) instead of copying it — together the four English fields index
     roughly 4× the English terms in every major English-speaking market.
   - Non-English locales spend their 100 chars on **native** genre terms (English genre terms
     already reach those storefronts via the indexed English localization).
3. **Singulars only, lowercase, no `game`/`app`/`free`,** no real brand names — Apple ignores
   or penalizes them.
4. CJK / RTL / Cyrillic / Greek / Thai / Hindi locales localize the app-name *descriptor*
   (`Silicon: <native "tech tycoon">`) where it reads naturally — the name is the
   highest-weight search field, and Latin-only names forfeit native-script search in those
   markets. The brand word "Silicon" stays in Latin script everywhere.

## Upload order (effort vs. revenue)

ASC → App → **App Information / Version Information** → `+` next to the localization list.
Suggested order if you don't paste all at once: `de-DE, ja, fr-FR, zh-Hans, ko, pt-BR, es-MX,
es-ES, it, en-GB, ru, tr, nl-NL, pl, zh-Hant` … then the rest. Every added localization is
pure ranking upside; there is no downside to shipping all 39.

## Maintenance

- New release → update `release_notes.txt` per locale (or just the top markets and let the
  rest keep the previous note — ASC allows stale What's New per locale).
- Keyword iteration → change only `keywords.txt`/`subtitle.txt` for the target locale, re-run
  the validator, re-submit with the next build.
- The game UI itself is currently English-only. That's fine for a sim of this genre, but
  expect some reviews mentioning it in ja/zh/ko — when in-game localization ships, these
  listings need no change.
