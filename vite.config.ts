import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

/**
 * Build configuration.
 *
 * Deploy target: Vercel. Nitro emits Vercel's Build Output API format automatically when it
 * runs on Vercel. To build for something else, set NITRO_PRESET at build time
 * (e.g. `NITRO_PRESET=node-server npm run build`). See https://nitro.build/deploy.
 */
export default defineConfig(({ command }) => ({
  server: { host: true, port: 3000 },
  css: { transformer: "lightningcss" },
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Our SSR error wrapper (src/server.ts) is the server entry.
      server: { entry: "server" },
      // Anything inside a `server/` directory can never be bundled for the browser.
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    ...(command === "build" ? [nitro({ defaultPreset: "vercel" })] : []),
    viteReact(),
  ],
}));
