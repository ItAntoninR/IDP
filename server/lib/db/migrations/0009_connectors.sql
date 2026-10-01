CREATE TABLE "connector" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"oauth_client_id" text NOT NULL,
	"name" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by" text,
	CONSTRAINT "connector_oauth_client_id_unique" UNIQUE("oauth_client_id")
);
--> statement-breakpoint
CREATE TABLE "connector_pairing" (
	"id" text PRIMARY KEY NOT NULL,
	"device_code_hash" text NOT NULL,
	"user_code" text NOT NULL,
	"public_key" jsonb NOT NULL,
	"requested_name" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"poll_interval" integer NOT NULL,
	"last_polled_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"connector_id" text,
	"decided_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connector_pairing_device_code_hash_unique" UNIQUE("device_code_hash"),
	CONSTRAINT "connector_pairing_user_code_unique" UNIQUE("user_code")
);
--> statement-breakpoint
ALTER TABLE "connector" ADD CONSTRAINT "connector_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector" ADD CONSTRAINT "connector_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector" ADD CONSTRAINT "connector_revoked_by_user_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_pairing" ADD CONSTRAINT "connector_pairing_connector_id_connector_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."connector"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_pairing" ADD CONSTRAINT "connector_pairing_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connector_organization_idx" ON "connector" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "connector_pairing_expires_idx" ON "connector_pairing" USING btree ("expires_at");