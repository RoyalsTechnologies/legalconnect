-- AlterTable
ALTER TABLE "consultation_requests" ADD COLUMN "paymentOrderId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "consultation_requests_paymentOrderId_key" ON "consultation_requests"("paymentOrderId");
