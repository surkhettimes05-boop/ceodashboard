ALTER TABLE "stock_transfers"
  ADD COLUMN "source_system" TEXT,
  ADD COLUMN "external_transfer_id" TEXT,
  ADD COLUMN "source_label" TEXT;

CREATE UNIQUE INDEX "stock_transfers_external_transfer_id_key"
  ON "stock_transfers"("external_transfer_id");

ALTER TABLE "transfer_receipts"
  ADD COLUMN "acknowledged_at" TIMESTAMP(3),
  ADD COLUMN "acknowledgement_error" TEXT;
