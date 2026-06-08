ALTER TABLE "PackOpening"
  ADD COLUMN "randomnessProvider" TEXT NOT NULL DEFAULT 'commit-reveal',
  ADD COLUMN "fairnessCommitTx" TEXT,
  ADD COLUMN "fairnessRevealTx" TEXT;

CREATE INDEX "PackOpening_randomnessProvider_idx" ON "PackOpening"("randomnessProvider");
CREATE INDEX "PackOpening_fairnessCommitTx_idx" ON "PackOpening"("fairnessCommitTx");
