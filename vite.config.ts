import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { version } from "./package.json";

// https://vite.dev/config/
export default defineConfig({
  // Single source of truth for the version string shown in Settings — package.json.
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    VitePWA({
      // The app already ships a hand-written manifest at public/manifest.webmanifest,
      // so we don't let the plugin emit its own — `manifest: false` keeps a single source.
      registerType: "autoUpdate",
      manifest: false,
      // index.html links the manifest itself; the plugin should not inject another one.
      injectRegister: null,
      includeAssets: [
        "icon.svg",
        "icon-192.png",
        "icon-512.png",
        "icon-512-maskable.png",
        "apple-touch-icon-180.png",
        "manifest.webmanifest",
      ],
      workbox: {
        // Precache the app shell + all first-party static assets. .glb models are large and
        // many, so they're handled by a runtime CacheFirst route below instead of precache.
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        globIgnores: ["**/furniture/*.glb"],
        navigateFallback: "index.html",
        // Three's lazy chunk can be sizeable; raise the precache limit so the shell is complete.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            // Cache 3D furniture models on first 3D-office open, then serve offline.
            urlPattern: ({ url }) => url.pathname.includes("/furniture/") && url.pathname.endsWith(".glb"),
            handler: "CacheFirst",
            options: {
              cacheName: "furniture-models",
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // Keep the SW out of `vite dev` so it never interferes with HMR / native dev.
        enabled: false,
      },
    }),
  ],
  base: "./",
  server: { port: 5173 },
  build: {
    // Split the heavy three.js core into its own cacheable chunk (the lazy 3D office chunk
    // pulls in ~900KB; isolating three lets the app shell + r3f glue cache independently).
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
        },
      },
    },
  },
});
