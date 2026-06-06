-- Custody-gate + money-path guards enforced at the database layer (spec §3, §5).
-- These complement the structural FKs/uniques already in the schema.

-- 1) At most ONE active listing per vault item (anti double-listing).
CREATE UNIQUE INDEX "Listing_one_active_per_vaultItem"
  ON "Listing" ("vaultItemId")
  WHERE "status" = 'ACTIVE';

-- 2) Ledger amounts are strictly positive; direction carries the sign.
ALTER TABLE "LedgerEntry"
  ADD CONSTRAINT "LedgerEntry_amount_positive" CHECK ("amountUsdc" > 0);

-- 3) Double-entry invariant: per order, total DEBITs must equal total CREDITs.
--    Enforced as a DEFERRED constraint trigger so multi-row inserts within a
--    single transaction are validated at COMMIT, not mid-write.
CREATE OR REPLACE FUNCTION check_ledger_balanced() RETURNS trigger AS $$
DECLARE
  v_order text;
  v_debit numeric;
  v_credit numeric;
BEGIN
  v_order := COALESCE(NEW."orderId", OLD."orderId");
  SELECT
    COALESCE(SUM(CASE WHEN "direction"::text = 'DEBIT'  THEN "amountUsdc" ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN "direction"::text = 'CREDIT' THEN "amountUsdc" ELSE 0 END), 0)
  INTO v_debit, v_credit
  FROM "LedgerEntry"
  WHERE "orderId" = v_order;

  IF v_debit <> v_credit THEN
    RAISE EXCEPTION 'Ledger for order % is unbalanced (debits=%, credits=%)',
      v_order, v_debit, v_credit;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "LedgerEntry_balanced"
  AFTER INSERT OR UPDATE OR DELETE ON "LedgerEntry"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_ledger_balanced();
