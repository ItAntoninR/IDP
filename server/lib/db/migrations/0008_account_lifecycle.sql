CREATE TABLE "deleted_account_archive" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"reason" text NOT NULL,
	"account_created_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"connections" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "last_active_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "inactivity_warned_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
CREATE INDEX "deleted_account_archive_email_idx" ON "deleted_account_archive" USING btree ("email");--> statement-breakpoint
CREATE INDEX "deleted_account_archive_expires_idx" ON "deleted_account_archive" USING btree ("expires_at");--> statement-breakpoint
UPDATE "user" SET "last_active_at" = COALESCE((SELECT max("created_at") FROM "session" WHERE "session"."user_id" = "user"."id"), "updated_at", "created_at");