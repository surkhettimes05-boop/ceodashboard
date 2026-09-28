-- add_loyalty_system needs the temporary default restored by the preceding
-- compatibility migration to seed its row after sync_schema. Remove the
-- temporary default afterward to match the Prisma @updatedAt contract.
ALTER TABLE "loyalty_settings"
  ALTER COLUMN "updated_at" DROP DEFAULT;
