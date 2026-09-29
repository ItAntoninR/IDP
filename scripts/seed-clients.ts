import { seedClients } from "../server/lib/oauth/clients";
import { pool } from "../server/lib/db/index";

const rotateSecrets = process.argv.includes("--rotate-secrets");
const clients = await seedClients({ rotateSecrets });

for (const c of clients) {
  console.log(`\n[${c.appId}] ${c.created ? "created" : "updated"}`);
  console.log(`  resource      ${c.resource}`);
  console.log(`  client_id     ${c.clientId}`);
  console.log(
    `  client_secret ${c.clientSecret ?? "(unchanged — run `pnpm seed:clients --rotate-secrets` to issue a new one)"}`,
  );
}
console.log("\nStore the secrets now: they are hashed at rest and cannot be displayed again.");
await pool.end();
