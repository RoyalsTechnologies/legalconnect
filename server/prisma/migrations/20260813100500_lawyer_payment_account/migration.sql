-- CreateEnum
CREATE TYPE "MomoNetwork" AS ENUM ('MTN', 'AT', 'TELECEL');

-- AlterTable
ALTER TABLE "lawyer_profiles" ADD COLUMN "paymentAccountName" TEXT;
ALTER TABLE "lawyer_profiles" ADD COLUMN "paymentPhone" TEXT;
ALTER TABLE "lawyer_profiles" ADD COLUMN "paymentNetwork" "MomoNetwork";
