-- Referral attribution and wallet-settled referral bonuses.

ALTER TYPE "OrderType" ADD VALUE IF NOT EXISTS 'REFERRAL_BONUS';

CREATE TYPE "ReferralRewardStatus" AS ENUM ('PENDING', 'AVAILABLE', 'PAID', 'VOID');

ALTER TABLE "User"
  ADD COLUMN "referralCode" TEXT,
  ADD COLUMN "referredById" TEXT;

CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
CREATE INDEX "User_referredById_idx" ON "User"("referredById");

ALTER TABLE "User"
  ADD CONSTRAINT "User_referredById_fkey"
  FOREIGN KEY ("referredById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ReferralReward" (
  "id" TEXT NOT NULL,
  "referrerId" TEXT NOT NULL,
  "referredUserId" TEXT NOT NULL,
  "sourceOrderId" TEXT,
  "payoutOrderId" TEXT,
  "eventType" TEXT NOT NULL,
  "status" "ReferralRewardStatus" NOT NULL DEFAULT 'PENDING',
  "amountUsdc" DECIMAL(18,6) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralReward_sourceOrderId_key" ON "ReferralReward"("sourceOrderId");
CREATE UNIQUE INDEX "ReferralReward_payoutOrderId_key" ON "ReferralReward"("payoutOrderId");
CREATE INDEX "ReferralReward_referrerId_idx" ON "ReferralReward"("referrerId");
CREATE INDEX "ReferralReward_referredUserId_idx" ON "ReferralReward"("referredUserId");
CREATE INDEX "ReferralReward_status_idx" ON "ReferralReward"("status");

ALTER TABLE "ReferralReward"
  ADD CONSTRAINT "ReferralReward_referrerId_fkey"
  FOREIGN KEY ("referrerId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReferralReward"
  ADD CONSTRAINT "ReferralReward_referredUserId_fkey"
  FOREIGN KEY ("referredUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReferralReward"
  ADD CONSTRAINT "ReferralReward_sourceOrderId_fkey"
  FOREIGN KEY ("sourceOrderId") REFERENCES "Order"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReferralReward"
  ADD CONSTRAINT "ReferralReward_payoutOrderId_fkey"
  FOREIGN KEY ("payoutOrderId") REFERENCES "Order"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
