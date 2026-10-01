import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";

describe("environment validation", () => {
  it("refuses to start when required variables are missing or invalid", () => {
    const env = { ...process.env };

    delete env.DATABASE_URL;
    env.BETTER_AUTH_SECRET = "too-short";
    const res = spawnSync(process.execPath, ["--import", "tsx", "-e", "await import('./server/lib/env.ts')"], {
      env,
      encoding: "utf8",
    });

    expect(res.status).not.toBe(0);
    expect(res.stderr).toContain("DATABASE_URL");
    expect(res.stderr).toContain("BETTER_AUTH_SECRET");
  });
});
