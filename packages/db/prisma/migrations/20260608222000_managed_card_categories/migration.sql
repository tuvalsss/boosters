CREATE TABLE "ManagedCardCategory" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "legacyCategory" "CardCategory" NOT NULL DEFAULT 'OTHER',
  "description" TEXT,
  "imageUrl" TEXT,
  "accentColor" TEXT NOT NULL DEFAULT '#22c55e',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ManagedCardCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManagedCardCategory_slug_key" ON "ManagedCardCategory"("slug");
CREATE INDEX "ManagedCardCategory_active_idx" ON "ManagedCardCategory"("active");
CREATE INDEX "ManagedCardCategory_sortOrder_idx" ON "ManagedCardCategory"("sortOrder");

INSERT INTO "ManagedCardCategory" (
  "id",
  "slug",
  "name",
  "legacyCategory",
  "description",
  "imageUrl",
  "accentColor",
  "sortOrder",
  "updatedAt"
) VALUES
  ('cat_pokemon', 'pokemon', 'Pokemon / Creature TCG', 'POKEMON', 'Licensed Pokemon-style inventory category. Upload only licensed art/assets.', '/assets/brand-packs/creature.svg', '#2563eb', 10, CURRENT_TIMESTAMP),
  ('cat_sports', 'sports', 'Sports Cards', 'SPORTS', 'Rookie, vintage, graded and slabbed sports cards.', '/assets/brand-packs/sports.svg', '#ef4444', 20, CURRENT_TIMESTAMP),
  ('cat_tcg', 'tcg', 'Trading Card Games', 'TCG', 'Fantasy, anime and game TCG inventory.', '/assets/brand-packs/legend.svg', '#7c3aed', 30, CURRENT_TIMESTAMP),
  ('cat_other', 'other', 'Other Collectibles', 'OTHER', 'Fallback category for special drops and collectibles.', '/assets/brand-packs/gold.svg', '#f59e0b', 40, CURRENT_TIMESTAMP);
