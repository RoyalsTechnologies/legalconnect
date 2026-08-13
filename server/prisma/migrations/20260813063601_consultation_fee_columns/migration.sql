-- AlterTable
ALTER TABLE "lawyer_profiles" ADD COLUMN "consultationFeePesewas" INTEGER NOT NULL DEFAULT 20000;

-- AlterTable
ALTER TABLE "consultation_requests" ADD COLUMN "feePesewas" INTEGER NOT NULL DEFAULT 20000;
ALTER TABLE "consultation_requests" ADD COLUMN "paymentReference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "consultation_requests_paymentReference_key" ON "consultation_requests"("paymentReference");

-- AlterTable
ALTER TABLE "consultation_requests" ALTER COLUMN "status" SET DEFAULT 'AWAITING_PAYMENT';
