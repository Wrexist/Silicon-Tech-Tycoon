import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
