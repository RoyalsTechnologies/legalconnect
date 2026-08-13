-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLIENT', 'LAWYER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('NORMAL', 'IMPORTANT', 'URGENT');

-- CreateEnum
CREATE TYPE "AiStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED_FALLBACK');

-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lawyer_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "firmName" TEXT,
    "bio" TEXT NOT NULL,
    "licenseNumber" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "yearsExperience" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lawyer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "legal_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lawyer_practice_areas" (
    "lawyerProfileId" TEXT NOT NULL,
    "legalCategoryId" TEXT NOT NULL,

    CONSTRAINT "lawyer_practice_areas_pkey" PRIMARY KEY ("lawyerProfileId","legalCategoryId")
);

-- CreateTable
CREATE TABLE "legal_intakes" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "originalDescription" TEXT NOT NULL,
    "city" TEXT,
    "region" TEXT,
    "categoryId" TEXT,
    "aiSummary" TEXT,
    "urgency" "Urgency",
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidence" DOUBLE PRECISION,
    "needsHumanReview" BOOLEAN NOT NULL DEFAULT true,
    "aiStatus" "AiStatus" NOT NULL DEFAULT 'PENDING',
    "aiError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_intakes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_requests" (
    "id" TEXT NOT NULL,
    "intakeId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "lawyerProfileId" TEXT NOT NULL,
    "status" "ConsultationStatus" NOT NULL DEFAULT 'PENDING',
    "clientMessage" TEXT,
    "matchReason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "lawyer_profiles_userId_key" ON "lawyer_profiles"("userId");

-- CreateIndex
CREATE INDEX "lawyer_profiles_approvalStatus_isAvailable_idx" ON "lawyer_profiles"("approvalStatus", "isAvailable");

-- CreateIndex
CREATE INDEX "lawyer_profiles_region_idx" ON "lawyer_profiles"("region");

-- CreateIndex
CREATE UNIQUE INDEX "legal_categories_name_key" ON "legal_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "legal_categories_slug_key" ON "legal_categories"("slug");

-- CreateIndex
CREATE INDEX "lawyer_practice_areas_legalCategoryId_idx" ON "lawyer_practice_areas"("legalCategoryId");

-- CreateIndex
CREATE INDEX "legal_intakes_clientId_idx" ON "legal_intakes"("clientId");

-- CreateIndex
CREATE INDEX "legal_intakes_aiStatus_idx" ON "legal_intakes"("aiStatus");

-- CreateIndex
CREATE INDEX "consultation_requests_lawyerProfileId_status_idx" ON "consultation_requests"("lawyerProfileId", "status");

-- CreateIndex
CREATE INDEX "consultation_requests_clientId_idx" ON "consultation_requests"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "consultation_requests_intakeId_lawyerProfileId_key" ON "consultation_requests"("intakeId", "lawyerProfileId");

-- AddForeignKey
ALTER TABLE "lawyer_profiles" ADD CONSTRAINT "lawyer_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyer_practice_areas" ADD CONSTRAINT "lawyer_practice_areas_lawyerProfileId_fkey" FOREIGN KEY ("lawyerProfileId") REFERENCES "lawyer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lawyer_practice_areas" ADD CONSTRAINT "lawyer_practice_areas_legalCategoryId_fkey" FOREIGN KEY ("legalCategoryId") REFERENCES "legal_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_intakes" ADD CONSTRAINT "legal_intakes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_intakes" ADD CONSTRAINT "legal_intakes_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "legal_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_requests" ADD CONSTRAINT "consultation_requests_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "legal_intakes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_requests" ADD CONSTRAINT "consultation_requests_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_requests" ADD CONSTRAINT "consultation_requests_lawyerProfileId_fkey" FOREIGN KEY ("lawyerProfileId") REFERENCES "lawyer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
