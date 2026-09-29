import { env } from "../../lib/env";
import { APPS } from "../../lib/apps";
import { APP_IDS } from "../../../shared/permissions";

export default defineEventHandler(() => ({
  googleEnabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  microsoftEnabled: Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET),
  authentikEnabled: Boolean(env.AUTHENTIK_ISSUER && env.AUTHENTIK_CLIENT_ID && env.AUTHENTIK_CLIENT_SECRET),
  apps: APP_IDS.map((id) => ({ id, label: APPS[id].label, url: APPS[id].url })),
}));
