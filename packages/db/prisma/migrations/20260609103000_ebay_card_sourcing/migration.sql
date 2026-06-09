-- eBay sourcing catalog: listings discovered via the official Browse API.
-- These rows are not custody-backed inventory until ops creates intake and
-- runs the normal receive/authenticate/grade/vault workflow.

CREATE TYPE "EbayListingStatus" AS ENUM ('ACTIVE', 'STALE', 'IMPORTED', 'RETIRED');

CREATE TABLE "EbayCardListing" (
  "id" TEXT NOT NULL,
  "ebayItemId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "cardName" TEXT NOT NULL,
  "category" "CardCategory" NOT NULL DEFAULT 'OTHER',
  "setName" TEXT,
  "grader" "Grader" NOT NULL DEFAULT 'RAW',
  "grade" TEXT,
  "year" INTEGER,
  "tier" TEXT NOT NULL DEFAULT 'common',
  "condition" TEXT,
  "imageUrl" TEXT NOT NULL,
  "itemWebUrl" TEXT NOT NULL,
  "itemAffiliateWebUrl" TEXT,
  "priceValue" DECIMAL(18, 6) NOT NULL,
  "priceCurrency" TEXT NOT NULL DEFAULT 'USD',
  "buyingOptions" JSONB NOT NULL DEFAULT '[]',
  "sellerUsername" TEXT,
  "sellerFeedbackPercentage" TEXT,
  "sourceQuery" TEXT,
  "sourcePayload" JSONB NOT NULL DEFAULT '{}',
  "status" "EbayListingStatus" NOT NULL DEFAULT 'ACTIVE',
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EbayCardListing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EbayCardListing_ebayItemId_key" ON "EbayCardListing"("ebayItemId");
CREATE INDEX "EbayCardListing_status_idx" ON "EbayCardListing"("status");
CREATE INDEX "EbayCardListing_tier_idx" ON "EbayCardListing"("tier");
CREATE INDEX "EbayCardListing_category_idx" ON "EbayCardListing"("category");
