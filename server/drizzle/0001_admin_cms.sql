ALTER TABLE "pilots" ADD COLUMN IF NOT EXISTS "suspended" boolean NOT NULL DEFAULT false;
ALTER TABLE "pilots" ADD COLUMN IF NOT EXISTS "leaderboard_hidden" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "announcements" (
  "id" uuid PRIMARY KEY,
  "title" varchar(80) NOT NULL,
  "message" varchar(500) NOT NULL,
  "severity" varchar(12) NOT NULL DEFAULT 'info',
  "active" boolean NOT NULL DEFAULT true,
  "starts_at" timestamptz,
  "ends_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "announcements_severity_check" CHECK ("severity" IN ('info', 'success', 'warning', 'critical'))
);

CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
  "id" uuid PRIMARY KEY,
  "admin_name" varchar(40) NOT NULL,
  "action" varchar(80) NOT NULL,
  "pilot_id" uuid REFERENCES "pilots"("id") ON DELETE SET NULL,
  "details" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "admin_audit_created_idx" ON "admin_audit_logs" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "announcements_active_idx" ON "announcements" ("active", "starts_at", "ends_at");
