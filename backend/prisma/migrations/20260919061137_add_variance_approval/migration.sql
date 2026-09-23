-- AlterTable
ALTER TABLE "register_sessions" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by" TEXT,
ADD COLUMN     "variance_approved" BOOLEAN NOT NULL DEFAULT false;
