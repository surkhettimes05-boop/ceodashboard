-- CreateTable
CREATE TABLE "transfer_receipts" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "transfer_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "destination_store_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_by" TEXT NOT NULL,

    CONSTRAINT "transfer_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_receipt_items" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "receipt_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "expected_quantity" DECIMAL(12,3) NOT NULL,
    "received_quantity" DECIMAL(12,3) NOT NULL,
    "remaining_quantity" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "transfer_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transfer_receipts_idempotency_key_key" ON "transfer_receipts"("idempotency_key");
CREATE INDEX "transfer_receipts_transfer_id_idx" ON "transfer_receipts"("transfer_id");
CREATE UNIQUE INDEX "transfer_receipt_items_receipt_id_product_id_key" ON "transfer_receipt_items"("receipt_id", "product_id");

-- AddForeignKey
ALTER TABLE "transfer_receipts" ADD CONSTRAINT "transfer_receipts_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "stock_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transfer_receipt_items" ADD CONSTRAINT "transfer_receipt_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "transfer_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transfer_receipt_items" ADD CONSTRAINT "transfer_receipt_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
