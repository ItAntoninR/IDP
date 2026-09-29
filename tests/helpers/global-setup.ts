import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { TEST_BASE_URL, TEST_ENV } from "./test-env";

let server: ChildProcess | undefined;

async function waitForHealth(timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${TEST_BASE_URL}/healthz`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Test server did not start");
}

export async function setup() {
  const pool = new pg.Pool({ connectionString: TEST_ENV.DATABASE_URL });
  await migrate(drizzle(pool), { migrationsFolder: "server/lib/db/migrations" });
  await pool.end();

  if (process.env.SKIP_BUILD !== "1") {
    const build = spawnSync("pnpm", ["exec", "nuxt", "build"], { stdio: "inherit", shell: true });
    if (build.status !== 0) throw new Error("nuxt build failed");
  }

  server = spawn(
    process.execPath,
    ["--import", "tsx", "--import", "./tests/helpers/fake-idp.ts", ".output/server/index.mjs"],
    { env: { ...process.env, ...TEST_ENV }, stdio: ["ignore", "inherit", "inherit"] },
  );
  await waitForHealth(30_000);
}

export async function teardown() {
  server?.kill();
}
