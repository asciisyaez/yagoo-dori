import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Real-data optimizer proofs can exceed Vitest's five-second default on
    // shared runners even when their deterministic scope is unchanged.
    testTimeout: 15_000,
    coverage: {
      reporter: ["text", "json-summary"],
    },
    include: ["src/**/*.test.ts"],
  },
});
