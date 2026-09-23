-- CreateEnum
CREATE TYPE "PaymentReconciliationStatus" AS ENUM ('PENDING', 'MATCHED', 'DISCREPANCY', 'RESOLVED');

-- CreateTable
CREATE TABLE "payment_reconciliations" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "expected_amount" DECIMAL(12,2) NOT NULL,
    "actual_amount" DECIMAL(12,2) NOT NULL,
    "discrepancy" DECIMAL(12,2) NOT NULL,
    "status" "PaymentReconciliationStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "reconciled_by" TEXT,
    "reconciled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_reconciliations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "register_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
