ALTER TABLE "runs" ADD COLUMN IF NOT EXISTS "paradox" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN IF NOT EXISTS "eternal_level" smallint NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "leaderboard_entries" DROP CONSTRAINT IF EXISTS "leaderboard_category_check";
--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_category_check" CHECK ("category" IN ('scores', 'titan', 'paradox'));
