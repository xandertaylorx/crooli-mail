import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const here = fileURLToPath(new URL(".", import.meta.url));
const mod = (name: string) => resolve(here, "node_modules", name);

// The site embeds the real app UI (../src) as live demos. On Vercel only web/ has
// node_modules, so the app's bare imports are pinned to this folder's copies.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ["react", "react-dom", "zustand", "@tanstack/react-virtual", "@tauri-apps/api"],
    alias: [
      { find: "@app", replacement: resolve(here, "../src") },
      { find: /^tailwindcss$/, replacement: mod("tailwindcss") },
    ],
  },
  server: { port: 5180, fs: { allow: [resolve(here, "..")] } },
  build: {
    rollupOptions: {
      input: {
        main: resolve(here, "index.html"),
        demo: resolve(here, "demo/index.html"),
      },
    },
  },
});
