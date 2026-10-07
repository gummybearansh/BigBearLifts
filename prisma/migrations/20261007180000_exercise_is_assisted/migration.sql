ALTER TABLE "Exercise" ADD COLUMN IF NOT EXISTS "isAssisted" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Exercise" SET "isAssisted" = true WHERE name = 'Assisted Wide Dips';
