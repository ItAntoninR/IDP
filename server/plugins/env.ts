import { env } from "../lib/env";
import { logger } from "../lib/support/logger";

export default defineNitroPlugin(() => {
  logger.info("auth service ready", { baseUrl: env.AUTH_BASE_URL, env: env.NODE_ENV });
});
