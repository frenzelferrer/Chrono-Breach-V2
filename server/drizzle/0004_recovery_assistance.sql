ALTER TABLE "pilots" ADD COLUMN "recovery_requested_at" timestamp with time zone;
CREATE INDEX "pilots_recovery_request_idx" ON "pilots" USING btree ("recovery_requested_at");
