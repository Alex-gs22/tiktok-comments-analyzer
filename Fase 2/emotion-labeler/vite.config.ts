import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/tiktok-comments-analyzer/",
  build: {
    outDir: "../../docs",
    emptyOutDir: true,
  },
});
