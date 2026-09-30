import { defineConfig } from "vitest/config";
import { TEST_ENV } from "./tests/helpers/test-env.ts";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/helpers/global-setup.ts"],
    setupFiles: ["tests/helpers/fake-idp.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 180_000,
    env: TEST_ENV,
  },
});
