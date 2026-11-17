import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: { include: ["lib/**/*.test.ts"], env: { HEDGES_DB_PATH: ":memory:", ODDS_DB_PATH: ":memory:" } },
});
