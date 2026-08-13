-- CreateEnum
CREATE TYPE "WalletLedgerType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "PayoutType" AS ENUM ('REFUND', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- AlterTable
ALTER TABLE "consultation_requests" ADD COLUMN "clientConfirmedAt" TIMESTAMP(3);
ALTER TABLE "consultation_requests" ADD COLUMN "lawyerConfirmedAt" TIMESTAMP(3);
ALTER TABLE "consultation_requests" ADD COLUMN "payerPhone" TEXT;
ALTER TABLE "consultation_requests" ADD COLUMN "payerNetwork" "MomoNetwork";
ALTER TABLE "consultation_requests" ADD COLUMN "settledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "wallet_ledger" (
    "id" TEXT NOT NULL,
    "lawyerProfileId" TEXT NOT NULL,
    "amountPesewas" INTEGER NOT NULL,
    "type" "WalletLedgerType" NOT NULL,
    "consultationId" TEXT,
    "withdrawalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawal_requests" (
    "id" TEXT NOT NULL,
    "lawyerProfileId" TEXT NOT NULL,
    "amountPesewas" INTEGER NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "paymentReference" TEXT,
    "paymentOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "withdrawal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" TEXT NOT NULL,
    "type" "PayoutType" NOT NULL,
    "amountPesewas" INTEGER NOT NULL,
    "destinationPhone" TEXT NOT NULL,
    "destinationNetwork" "MomoNetwork",
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "paymentReference" TEXT,
    "paymentOrderId" TEXT,
    "consultationId" TEXT,
    "withdrawalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_ledger_consultationId_key" ON "wallet_ledger"("consultationId");

-- CreateIndex
CREATE INDEX "wallet_ledger_lawyerProfileId_createdAt_idx" ON "wallet_ledger"("lawyerProfileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_requests_paymentReference_key" ON "withdrawal_requests"("paymentReference");

-- CreateIndex
CREATE INDEX "withdrawal_requests_lawyerProfileId_createdAt_idx" ON "withdrawal_requests"("lawyerProfileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_paymentReference_key" ON "payouts"("paymentReference");

-- CreateIndex
CREATE INDEX "payouts_consultationId_idx" ON "payouts"("consultationId");

-- CreateIndex
CREATE INDEX "payouts_withdrawalId_idx" ON "payouts"("withdrawalId");

-- AddForeignKey
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_lawyerProfileId_fkey" FOREIGN KEY ("lawyerProfileId") REFERENCES "lawyer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultation_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "withdrawal_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_lawyerProfileId_fkey" FOREIGN KEY ("lawyerProfileId") REFERENCES "lawyer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultation_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "withdrawal_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
