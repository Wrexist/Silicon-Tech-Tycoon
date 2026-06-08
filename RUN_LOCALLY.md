# Running Silicon on your PC

No Xcode, no Mac needed — the whole game runs in your browser.

## One-time setup

1. Install **Node.js 20+**: https://nodejs.org → click the "LTS" download
2. Open a terminal in the project folder:
   - Windows: right-click the folder → "Open in Terminal"  
   - Or open Command Prompt / PowerShell and type `cd path\to\Silicon-Tech-Tycoon`
3. Install dependencies:
   ```
   npm install
   ```

## Every time you want to play / dev

```
npm run dev
```

Then open your browser to **http://localhost:5173**

The game hot-reloads — any file you save updates instantly in the browser.

## Other useful commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start the dev server (game in browser) |
| `npm test` | Run all engine unit tests |
| `npm run typecheck` | Check TypeScript for errors |
| `npm run build` | Build the production bundle into `dist/` |

## Stopping the server

Press **Ctrl+C** in the terminal.

---

That's it — the game is a web app, so everything works on Windows/Mac/Linux.
The iOS part (Capacitor/Xcode) is only needed when submitting to the App Store.
