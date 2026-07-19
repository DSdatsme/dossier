import "dotenv/config";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    // All test files share one SQLite file (test.db) with no per-file
    // isolation. The Prisma 7 driver adapter (better-sqlite3) needs an
    // exclusive lock per write, unlike the old query engine's connection
    // handling — running files in parallel causes real, intermittent lock
    // contention ("Operation has timed out") between unrelated test files.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
