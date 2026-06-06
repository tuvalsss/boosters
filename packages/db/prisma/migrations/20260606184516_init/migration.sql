-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'OPS', 'ADMIN');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AccountHold" AS ENUM ('NONE', 'NEW_ACCOUNT', 'MANUAL_REVIEW', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CardCategory" AS ENUM ('POKEMON', 'SPORTS', 'TCG', 'OTHER');

-- CreateEnum
CREATE TYPE "Grader" AS ENUM ('PSA', 'BGS', 'CGC', 'SGC', 'RAW', 'OTHER');

-- CreateEnum
CREATE TYPE "VaultItemState" AS ENUM ('INTAKE', 'AUTHENTICATING', 'GRADED', 'VAULTED', 'RESERVED', 'RELEASED');

-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('ACTIVE', 'BURNED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'LABEL_GENERATED', 'IN_TRANSIT', 'RECEIVED', 'AUTHENTICATING', 'GRADING', 'PHOTOGRAPHED', 'MINTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('FIRST_PARTY', 'P2P');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'HELD', 'SOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PackStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'SOLD_OUT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PackOpeningStatus" AS ENUM ('COMMITTED', 'DRAWN', 'REVEALED', 'SETTLED', 'FAILED');

-- CreateEnum
CREATE TYPE "RaffleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SOLD_OUT', 'DRAWING', 'DRAWN', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RaffleTicketStatus" AS ENUM ('ACTIVE', 'WON', 'REFUNDED');

-- CreateEnum
CREATE TYPE "BuybackQuoteStatus" AS ENUM ('QUOTED', 'ACCEPTED', 'EXPIRED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('MARKETPLACE_BUY', 'PACK_PURCHASE', 'RAFFLE_TICKET', 'BUYBACK_PAYOUT', 'CONSIGNMENT_PAYOUT', 'REFUND');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('TREASURY', 'FEE_REVENUE', 'USER_WALLET', 'ESCROW', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "FmvSource" AS ENUM ('MANUAL', 'TCGPLAYER', 'EBAY_SOLD', 'CARD_LADDER', 'PWCC', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "privyId" TEXT,
    "email" TEXT,
    "walletAddress" TEXT,
    "displayName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'NONE',
    "kycProviderRef" TEXT,
    "hold" "AccountHold" NOT NULL DEFAULT 'NEW_ACCOUNT',
    "reputationScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhysicalCard" (
    "id" TEXT NOT NULL,
    "category" "CardCategory" NOT NULL,
    "grader" "Grader" NOT NULL,
    "certNumber" TEXT,
    "grade" TEXT,
    "setName" TEXT,
    "cardName" TEXT NOT NULL,
    "year" INTEGER,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhysicalCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardPhoto" (
    "id" TEXT NOT NULL,
    "physicalCardId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'front',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultItem" (
    "id" TEXT NOT NULL,
    "physicalCardId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "state" "VaultItemState" NOT NULL DEFAULT 'INTAKE',
    "vaultLocation" TEXT,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL,
    "vaultItemId" TEXT NOT NULL,
    "cnftAssetId" TEXT NOT NULL,
    "merkleTree" TEXT NOT NULL,
    "leafIndex" INTEGER NOT NULL,
    "mintSignature" TEXT NOT NULL,
    "metadataUri" TEXT,
    "ownerId" TEXT NOT NULL,
    "status" "TokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "burnSignature" TEXT,
    "burnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "declaredCard" JSONB NOT NULL DEFAULT '{}',
    "shippingLabelUrl" TEXT,
    "trackingNumber" TEXT,
    "vaultItemId" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionEvent" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "vaultItemId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "type" "ListingType" NOT NULL,
    "priceUsdc" DECIMAL(18,6) NOT NULL,
    "fmvLowUsdc" DECIMAL(18,6),
    "fmvHighUsdc" DECIMAL(18,6),
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "heldReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceUsdc" DECIMAL(18,6) NOT NULL,
    "oddsConfig" JSONB NOT NULL DEFAULT '{}',
    "status" "PackStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackPoolItem" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "vaultItemId" TEXT NOT NULL,
    "tier" TEXT,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackPoolItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackOpening" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serverSeedHash" TEXT NOT NULL,
    "serverSeed" TEXT,
    "clientSeed" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL DEFAULT 0,
    "vrfRequest" TEXT,
    "vrfProof" TEXT,
    "resultVaultItemId" TEXT,
    "status" "PackOpeningStatus" NOT NULL DEFAULT 'COMMITTED',
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revealedAt" TIMESTAMP(3),

    CONSTRAINT "PackOpening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Raffle" (
    "id" TEXT NOT NULL,
    "vaultItemId" TEXT NOT NULL,
    "ticketSupply" INTEGER NOT NULL,
    "ticketsSold" INTEGER NOT NULL DEFAULT 0,
    "ticketPriceUsdc" DECIMAL(18,6) NOT NULL,
    "status" "RaffleStatus" NOT NULL DEFAULT 'DRAFT',
    "vrfRequest" TEXT,
    "vrfProof" TEXT,
    "winnerId" TEXT,
    "drawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Raffle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaffleTicket" (
    "id" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticketNumber" INTEGER NOT NULL,
    "status" "RaffleTicketStatus" NOT NULL DEFAULT 'ACTIVE',
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaffleTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuybackQuote" (
    "id" TEXT NOT NULL,
    "vaultItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fmvSnapshotId" TEXT,
    "percentBps" INTEGER NOT NULL,
    "quoteUsdc" DECIMAL(18,6) NOT NULL,
    "status" "BuybackQuoteStatus" NOT NULL DEFAULT 'QUOTED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuybackQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "type" "OrderType" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "buyerId" TEXT,
    "sellerId" TEXT,
    "listingId" TEXT,
    "amountUsdc" DECIMAL(18,6) NOT NULL,
    "feeUsdc" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "onchainSignature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "accountType" "LedgerAccountType" NOT NULL,
    "userId" TEXT,
    "direction" "LedgerDirection" NOT NULL,
    "amountUsdc" DECIMAL(18,6) NOT NULL,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FmvSnapshot" (
    "id" TEXT NOT NULL,
    "physicalCardId" TEXT,
    "vaultItemId" TEXT,
    "source" "FmvSource" NOT NULL,
    "valueUsdc" DECIMAL(18,6) NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FmvSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromState" TEXT,
    "toState" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_privyId_key" ON "User"("privyId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_kycStatus_idx" ON "User"("kycStatus");

-- CreateIndex
CREATE INDEX "PhysicalCard_category_idx" ON "PhysicalCard"("category");

-- CreateIndex
CREATE INDEX "PhysicalCard_cardName_idx" ON "PhysicalCard"("cardName");

-- CreateIndex
CREATE UNIQUE INDEX "PhysicalCard_grader_certNumber_key" ON "PhysicalCard"("grader", "certNumber");

-- CreateIndex
CREATE INDEX "CardPhoto_physicalCardId_idx" ON "CardPhoto"("physicalCardId");

-- CreateIndex
CREATE UNIQUE INDEX "VaultItem_physicalCardId_key" ON "VaultItem"("physicalCardId");

-- CreateIndex
CREATE INDEX "VaultItem_ownerId_idx" ON "VaultItem"("ownerId");

-- CreateIndex
CREATE INDEX "VaultItem_state_idx" ON "VaultItem"("state");

-- CreateIndex
CREATE UNIQUE INDEX "Token_vaultItemId_key" ON "Token"("vaultItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Token_cnftAssetId_key" ON "Token"("cnftAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "Token_mintSignature_key" ON "Token"("mintSignature");

-- CreateIndex
CREATE UNIQUE INDEX "Token_burnSignature_key" ON "Token"("burnSignature");

-- CreateIndex
CREATE INDEX "Token_ownerId_idx" ON "Token"("ownerId");

-- CreateIndex
CREATE INDEX "Token_status_idx" ON "Token"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_vaultItemId_key" ON "Submission"("vaultItemId");

-- CreateIndex
CREATE INDEX "Submission_userId_idx" ON "Submission"("userId");

-- CreateIndex
CREATE INDEX "Submission_status_idx" ON "Submission"("status");

-- CreateIndex
CREATE INDEX "SubmissionEvent_submissionId_idx" ON "SubmissionEvent"("submissionId");

-- CreateIndex
CREATE INDEX "Listing_vaultItemId_idx" ON "Listing"("vaultItemId");

-- CreateIndex
CREATE INDEX "Listing_status_idx" ON "Listing"("status");

-- CreateIndex
CREATE INDEX "Listing_type_idx" ON "Listing"("type");

-- CreateIndex
CREATE INDEX "Pack_status_idx" ON "Pack"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PackPoolItem_vaultItemId_key" ON "PackPoolItem"("vaultItemId");

-- CreateIndex
CREATE INDEX "PackPoolItem_packId_idx" ON "PackPoolItem"("packId");

-- CreateIndex
CREATE UNIQUE INDEX "PackOpening_resultVaultItemId_key" ON "PackOpening"("resultVaultItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PackOpening_orderId_key" ON "PackOpening"("orderId");

-- CreateIndex
CREATE INDEX "PackOpening_packId_idx" ON "PackOpening"("packId");

-- CreateIndex
CREATE INDEX "PackOpening_userId_idx" ON "PackOpening"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Raffle_vaultItemId_key" ON "Raffle"("vaultItemId");

-- CreateIndex
CREATE INDEX "Raffle_status_idx" ON "Raffle"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RaffleTicket_orderId_key" ON "RaffleTicket"("orderId");

-- CreateIndex
CREATE INDEX "RaffleTicket_userId_idx" ON "RaffleTicket"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RaffleTicket_raffleId_ticketNumber_key" ON "RaffleTicket"("raffleId", "ticketNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BuybackQuote_orderId_key" ON "BuybackQuote"("orderId");

-- CreateIndex
CREATE INDEX "BuybackQuote_vaultItemId_idx" ON "BuybackQuote"("vaultItemId");

-- CreateIndex
CREATE INDEX "BuybackQuote_userId_idx" ON "BuybackQuote"("userId");

-- CreateIndex
CREATE INDEX "BuybackQuote_status_idx" ON "BuybackQuote"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Order_onchainSignature_key" ON "Order"("onchainSignature");

-- CreateIndex
CREATE INDEX "Order_type_idx" ON "Order"("type");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_buyerId_idx" ON "Order"("buyerId");

-- CreateIndex
CREATE INDEX "Order_sellerId_idx" ON "Order"("sellerId");

-- CreateIndex
CREATE INDEX "LedgerEntry_orderId_idx" ON "LedgerEntry"("orderId");

-- CreateIndex
CREATE INDEX "LedgerEntry_accountType_idx" ON "LedgerEntry"("accountType");

-- CreateIndex
CREATE INDEX "LedgerEntry_userId_idx" ON "LedgerEntry"("userId");

-- CreateIndex
CREATE INDEX "FmvSnapshot_physicalCardId_idx" ON "FmvSnapshot"("physicalCardId");

-- CreateIndex
CREATE INDEX "FmvSnapshot_vaultItemId_idx" ON "FmvSnapshot"("vaultItemId");

-- CreateIndex
CREATE INDEX "FmvSnapshot_source_idx" ON "FmvSnapshot"("source");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- AddForeignKey
ALTER TABLE "CardPhoto" ADD CONSTRAINT "CardPhoto_physicalCardId_fkey" FOREIGN KEY ("physicalCardId") REFERENCES "PhysicalCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultItem" ADD CONSTRAINT "VaultItem_physicalCardId_fkey" FOREIGN KEY ("physicalCardId") REFERENCES "PhysicalCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultItem" ADD CONSTRAINT "VaultItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_vaultItemId_fkey" FOREIGN KEY ("vaultItemId") REFERENCES "VaultItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_vaultItemId_fkey" FOREIGN KEY ("vaultItemId") REFERENCES "VaultItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionEvent" ADD CONSTRAINT "SubmissionEvent_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_vaultItemId_fkey" FOREIGN KEY ("vaultItemId") REFERENCES "VaultItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackPoolItem" ADD CONSTRAINT "PackPoolItem_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackPoolItem" ADD CONSTRAINT "PackPoolItem_vaultItemId_fkey" FOREIGN KEY ("vaultItemId") REFERENCES "VaultItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackOpening" ADD CONSTRAINT "PackOpening_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackOpening" ADD CONSTRAINT "PackOpening_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Raffle" ADD CONSTRAINT "Raffle_vaultItemId_fkey" FOREIGN KEY ("vaultItemId") REFERENCES "VaultItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Raffle" ADD CONSTRAINT "Raffle_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaffleTicket" ADD CONSTRAINT "RaffleTicket_raffleId_fkey" FOREIGN KEY ("raffleId") REFERENCES "Raffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaffleTicket" ADD CONSTRAINT "RaffleTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuybackQuote" ADD CONSTRAINT "BuybackQuote_vaultItemId_fkey" FOREIGN KEY ("vaultItemId") REFERENCES "VaultItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuybackQuote" ADD CONSTRAINT "BuybackQuote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuybackQuote" ADD CONSTRAINT "BuybackQuote_fmvSnapshotId_fkey" FOREIGN KEY ("fmvSnapshotId") REFERENCES "FmvSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FmvSnapshot" ADD CONSTRAINT "FmvSnapshot_physicalCardId_fkey" FOREIGN KEY ("physicalCardId") REFERENCES "PhysicalCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FmvSnapshot" ADD CONSTRAINT "FmvSnapshot_vaultItemId_fkey" FOREIGN KEY ("vaultItemId") REFERENCES "VaultItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
