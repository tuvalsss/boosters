-- Local/manual KYC submissions, withdrawal metadata, and configurable pack visuals.

CREATE TYPE "KycIdentityDocumentType" AS ENUM ('ID_CARD', 'DRIVERS_LICENSE', 'PASSPORT');

CREATE TYPE "KycDocumentType" AS ENUM (
    'ID_FRONT',
    'ID_BACK',
    'DRIVERS_LICENSE_FRONT',
    'DRIVERS_LICENSE_BACK',
    'PASSPORT',
    'SELFIE',
    'PROOF_OF_ADDRESS'
);

ALTER TABLE "Pack"
    ADD COLUMN "brandLabel" TEXT NOT NULL DEFAULT 'BOOSTERS',
    ADD COLUMN "coverImageUrl" TEXT,
    ADD COLUMN "accentColor" TEXT NOT NULL DEFAULT '#22c55e',
    ADD COLUMN "tier" TEXT NOT NULL DEFAULT 'CORE';

ALTER TABLE "Order"
    ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "KycSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "documentType" "KycIdentityDocumentType" NOT NULL,
    "legalName" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "notes" TEXT,
    "reviewerNotes" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KycDocument" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "type" "KycDocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KycSubmission_userId_idx" ON "KycSubmission"("userId");
CREATE INDEX "KycSubmission_status_idx" ON "KycSubmission"("status");
CREATE INDEX "KycSubmission_reviewedAt_idx" ON "KycSubmission"("reviewedAt");
CREATE INDEX "KycDocument_submissionId_idx" ON "KycDocument"("submissionId");
CREATE INDEX "KycDocument_type_idx" ON "KycDocument"("type");

ALTER TABLE "KycSubmission"
    ADD CONSTRAINT "KycSubmission_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KycDocument"
    ADD CONSTRAINT "KycDocument_submissionId_fkey"
    FOREIGN KEY ("submissionId") REFERENCES "KycSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
