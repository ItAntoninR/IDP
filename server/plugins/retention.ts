import { runRetentionOnce } from "../lib/account-lifecycle";
import { env } from "../lib/env";
import { logger } from "../lib/support/logger";

const FIRST_RUN_DELAY_MS = 60 * 1000;
const INTERVAL_MS = 24 * 60 * 60 * 1000;

export default defineNitroPlugin((nitro) => {
  if (!env.RETENTION_ENABLED || import.meta.dev) return;
  const run = () => runRetentionOnce().catch((err) => logger.error("retention failed", { err }));
  const first = setTimeout(run, FIRST_RUN_DELAY_MS);
  const daily = setInterval(run, INTERVAL_MS);
  first.unref();
  daily.unref();
  nitro.hooks.hook("close", () => {
    clearTimeout(first);
    clearInterval(daily);
  });
});
