import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "../lib/db/index";
import { env } from "../lib/env";
import { logger } from "../lib/support/logger";

export default defineNitroPlugin(async () => {
  if (!env.MIGRATE_ON_START) return;
  await migrate(db, { migrationsFolder: env.MIGRATIONS_DIR });
  logger.info("migrations applied", { folder: env.MIGRATIONS_DIR });
});
