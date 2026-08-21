ALTER TABLE "pilots" ADD COLUMN IF NOT EXISTS "name_flagged" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "pilots" ADD COLUMN IF NOT EXISTS "requires_rename" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "pilots" ADD COLUMN IF NOT EXISTS "name_moderation_version" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pilots_name_moderation_idx" ON "pilots" ("name_flagged", "requires_rename");
