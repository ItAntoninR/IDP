import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./server/lib/db/schema.ts",
  out: "./server/lib/db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  casing: "snake_case",
});
