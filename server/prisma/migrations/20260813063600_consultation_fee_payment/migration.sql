-- AlterEnum
-- PostgreSQL cannot add an enum value and use it as a column default in the same
-- transaction, so this migration only introduces the value.
ALTER TYPE "ConsultationStatus" ADD VALUE 'AWAITING_PAYMENT';
