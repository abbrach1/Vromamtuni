import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The bundle is loaded inside the Capacitor WebView from a bundle-specific path,
// not the web root, so every asset URL must be RELATIVE. `base: "./"` is what
// makes that happen — an absolute base would 404 every asset on the tablet.
//
// Phase 2 next step wires in this repo's kiosk UI. When it does, add:
//   resolve.alias: {
//     "@": path.resolve(__dirname, "../src"),               // reuse his components
//     "next/navigation": path.resolve(__dirname, "src/shims/next-navigation.ts"),
//   }
// (plus @types/node for __dirname), and the few other next/* shims KioskApp needs.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    target: "es2019",
    emptyOutDir: true,
  },
});
