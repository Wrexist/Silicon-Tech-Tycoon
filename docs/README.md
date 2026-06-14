# Silicon: Tech Tycoon — website (GitHub Pages)

The public marketing + legal site for the app. Plain static HTML/CSS/JS — **no build
step, no dependencies, no external requests** (system fonts only, in keeping with the
app's no-tracking ethos). GitHub Pages serves this `docs/` folder as-is.

## Pages

| File | Served at | Use |
|------|-----------|-----|
| `index.html` | `/` | Landing / marketing page → **App Store "Marketing URL"** |
| `privacy/index.html` | `/privacy/` | Privacy policy → **App Store "Privacy Policy URL"** (required) |
| `support/index.html` | `/support/` | Support + FAQ → **App Store "Support URL"** (required) |
| `assets/` | `/assets/…` | Shared `styles.css`, `site.js`, icons |
| `.nojekyll` | — | Serve files verbatim (skip Jekyll processing) |

## Enable GitHub Pages (one-time)

1. Merge this branch into the branch Pages builds from (usually `main`).
2. Repo **Settings → Pages**.
3. **Source: Deploy from a branch** → **Branch: `main`** → **Folder: `/docs`** → **Save**.
4. Wait ~1 minute. The site goes live at:

```
https://wrexist.github.io/silicon-tech-tycoon/
https://wrexist.github.io/silicon-tech-tycoon/privacy/
https://wrexist.github.io/silicon-tech-tycoon/support/
```

Paste those three URLs into App Store Connect (Marketing / Privacy Policy / Support URL).

## Custom domain (optional)

To serve at e.g. `silicon.wrexist.com`: add a `CNAME` file here containing the domain,
set the DNS record at your registrar, then set the custom domain in Settings → Pages.
All links on the site are **relative**, so they keep working under any domain or path —
nothing to change in the HTML.

## Relationship to `public/privacy.html` & `public/support.html`

Those copies are bundled **inside the app** (linked from the in-app Settings screen) so the
legal text is reachable offline. This `docs/` site is the **public web** copy used for the
App Store URLs. Keep the two in sync when the policy text changes.

## Editing

Open any `.html` file directly in a browser — what you see is what ships. Design tokens
(colours, spacing, type, motion) live at the top of `assets/styles.css` and mirror the
app's `src/design/tokens.css` (light-primary with automatic dark mode).
