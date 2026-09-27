import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // Exercise Next.js TSX pages in integration tests instead of preserving JSX.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url))
    }
  },
  test: {
    // Auth.js uses Next.js extensionless imports; let Vite resolve them in real-auth tests.
    server: { deps: { inline: ["next-auth"] } },
    pool: "threads",
    maxWorkers: 1
  }
});
