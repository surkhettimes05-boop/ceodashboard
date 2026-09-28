-- The historical loyalty migration seeds a row without specifying updated_at.
-- sync_schema drops the column default before that migration is reached in
-- Prisma's lexicographic order, so restore its intended insertion default.
ALTER TABLE "loyalty_settings"
  ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
