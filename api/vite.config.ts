import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const serverBuildTarget = process.env.SERVER_BUILD_TARGET === "web" ? "web" : "fc";
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const fromRoot = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));

export default defineConfig({
  root: projectRoot,
  envDir: projectRoot,
  publicDir: false,
  ssr: {
    noExternal: true
  },
  resolve: {
    alias: [
      { find: /^@libsql\/client$/, replacement: "@libsql/client/web" },
      { find: /^@repo\/shared\/http$/, replacement: fromRoot("packages/shared/src/http.ts") },
      { find: /^@repo\/shared$/, replacement: fromRoot("packages/shared/src/index.ts") }
    ]
  },
  build: {
    ssr: serverBuildTarget === "web" ? "api/_core/fc-entry.web.ts" : "api/_core/fc-entry.ts",
    outDir: "api/dist",
    emptyOutDir: true,
    target: "node20",
    rollupOptions: {
      output: {
        format: "es",
        entryFileNames: "index.js"
      }
    }
  }
});
