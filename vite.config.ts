import { nitro } from "nitro/vite";
import path from "path";
import AutoImport from "unplugin-auto-import/vite";
import { defineConfig } from "vite";

// vite plugins
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import Fonts from "unplugin-fonts/vite";
import Inspect from "vite-plugin-inspect";
import Pages from "vite-plugin-pages";
import svgr from "vite-plugin-svgr";

import { fonts } from "./configs/fonts.config";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5000,
  },

  plugins: [
    nitro(),
    react(),
    Pages({
      dirs: "src/pages",
      extensions: ["tsx", "jsx"],
      importMode: "async",
    }),
    svgr(),

    Inspect(),
    // ViteImagemin() - commented out due to type issues, uncomment if needed
    tailwindcss(),
    Fonts({ google: { families: fonts } }),
    AutoImport({
      imports: ["react", "react-router"],
      dts: "./auto-imports.d.ts",
      eslintrc: {
        enabled: true,
        // filepath: "./eslint.config.js",
      },
      viteOptimizeDeps: true,

      // uncomment if you want to auto import ui components
      // dirs: ['./src/components/ui'],
    }),
  ],

  optimizeDeps: {
    include: [
      "@tanstack/charts",
      "@tanstack/charts/react",
      "@tanstack/charts/scales/band",
      "@tanstack/charts/scales/linear",
      "@tanstack/charts/scales/ordinal",
      "@tanstack/charts/tooltip",
    ],
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          tanstack: ["@tanstack/charts", "@tanstack/charts/react"],
          vendor: ["react", "react-dom", "react-router"],
        },
      },
    },
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
