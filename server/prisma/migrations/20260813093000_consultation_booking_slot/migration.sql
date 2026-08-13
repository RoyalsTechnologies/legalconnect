-- AlterTable
ALTER TABLE "consultation_requests" ADD COLUMN "scheduledAt" TIMESTAMP(3);
ALTER TABLE "consultation_requests" ADD COLUMN "meetUrl" TEXT;

-- Existing rows (if any) get a placeholder slot so the column can be required.
UPDATE "consultation_requests" SET "scheduledAt" = "createdAt" + INTERVAL '1 day' WHERE "scheduledAt" IS NULL;

ALTER TABLE "consultation_requests" ALTER COLUMN "scheduledAt" SET NOT NULL;
