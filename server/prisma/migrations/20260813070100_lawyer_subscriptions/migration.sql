-- CreateEnum
CREATE TYPE "SubscriptionPaymentStatus" AS ENUM ('PENDING', 'PAID');

-- CreateTable
CREATE TABLE "subscription_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "monthlyFeePesewas" INTEGER NOT NULL,
    "maxPracticeAreas" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_payments" (
    "id" TEXT NOT NULL,
    "lawyerProfileId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "feePesewas" INTEGER NOT NULL,
    "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentReference" TEXT,
    "paymentOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "lawyer_profiles" ADD COLUMN "subscriptionPackageId" TEXT;
ALTER TABLE "lawyer_profiles" ADD COLUMN "subscriptionPeriodEnd" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_packages_name_key" ON "subscription_packages"("name");
CREATE UNIQUE INDEX "subscription_packages_slug_key" ON "subscription_packages"("slug");
CREATE UNIQUE INDEX "subscription_payments_paymentReference_key" ON "subscription_payments"("paymentReference");
CREATE INDEX "subscription_payments_lawyerProfileId_status_idx" ON "subscription_payments"("lawyerProfileId", "status");
CREATE INDEX "lawyer_profiles_subscriptionPackageId_subscriptionPeriodEnd_idx" ON "lawyer_profiles"("subscriptionPackageId", "subscriptionPeriodEnd");

-- AddForeignKey
ALTER TABLE "lawyer_profiles" ADD CONSTRAINT "lawyer_profiles_subscriptionPackageId_fkey" FOREIGN KEY ("subscriptionPackageId") REFERENCES "subscription_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_lawyerProfileId_fkey" FOREIGN KEY ("lawyerProfileId") REFERENCES "lawyer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "subscription_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
