CREATE TABLE IF NOT EXISTS "pilots" (
  "id" uuid PRIMARY KEY,
  "display_name" varchar(12) NOT NULL,
  "discriminator" varchar(4) NOT NULL,
  "recovery_hash" varchar(64) NOT NULL UNIQUE,
  "save_data" jsonb NOT NULL,
  "best_score" integer NOT NULL DEFAULT 0,
  "revision" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" uuid PRIMARY KEY,
  "pilot_id" uuid NOT NULL REFERENCES "pilots"("id") ON DELETE CASCADE,
  "token_hash" varchar(64) NOT NULL UNIQUE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "last_seen_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "runs" (
  "id" uuid PRIMARY KEY,
  "pilot_id" uuid NOT NULL REFERENCES "pilots"("id") ON DELETE CASCADE,
  "client_event_id" uuid NOT NULL,
  "score" integer NOT NULL,
  "sector" smallint NOT NULL,
  "wave" integer NOT NULL,
  "mode" varchar(8) NOT NULL,
  "level" smallint NOT NULL,
  "kills" integer NOT NULL,
  "boss_kills" integer NOT NULL,
  "clear_time" real NOT NULL,
  "titan" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "runs_sector_check" CHECK ("sector" BETWEEN 1 AND 5),
  CONSTRAINT "runs_mode_check" CHECK ("mode" IN ('standard', 'endless')),
  CONSTRAINT "runs_pilot_event_unique" UNIQUE ("pilot_id", "client_event_id")
);

CREATE TABLE IF NOT EXISTS "leaderboard_entries" (
  "pilot_id" uuid NOT NULL REFERENCES "pilots"("id") ON DELETE CASCADE,
  "category" varchar(8) NOT NULL,
  "run_id" uuid NOT NULL REFERENCES "runs"("id") ON DELETE CASCADE,
  "score" integer NOT NULL,
  "achieved_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("pilot_id", "category"),
  CONSTRAINT "leaderboard_category_check" CHECK ("category" IN ('scores', 'titan'))
);

CREATE INDEX IF NOT EXISTS "leaderboard_score_idx" ON "leaderboard_entries" ("category", "score" DESC, "achieved_at" ASC);
CREATE INDEX IF NOT EXISTS "sessions_pilot_idx" ON "sessions" ("pilot_id");
CREATE INDEX IF NOT EXISTS "runs_pilot_idx" ON "runs" ("pilot_id", "created_at" DESC);
