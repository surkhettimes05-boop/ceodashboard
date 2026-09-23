-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED', 'VOIDED', 'CANCELLED');

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN     "void_reason" TEXT,
ADD COLUMN     "voided_at" TIMESTAMP(3),
ADD COLUMN     "voided_by" TEXT;
