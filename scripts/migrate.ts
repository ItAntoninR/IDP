import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../server/lib/db/index";

await migrate(db, { migrationsFolder: "server/lib/db/migrations" });
console.log("Migrations applied.");
await pool.end();
