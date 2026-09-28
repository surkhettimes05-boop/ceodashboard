CREATE TABLE "online_fulfillments" (
  "id" TEXT NOT NULL,
  "external_order_id" TEXT NOT NULL,
  "pasalo_order_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RESERVED',
  "sale_id" TEXT,
  "customer_name" TEXT,
  "shipping_address" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "online_fulfillments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "online_fulfillment_items" (
  "id" TEXT NOT NULL,
  "fulfillment_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "online_fulfillment_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "online_fulfillments_external_order_id_key"
  ON "online_fulfillments"("external_order_id");
CREATE UNIQUE INDEX "online_fulfillments_pasalo_order_id_key"
  ON "online_fulfillments"("pasalo_order_id");
CREATE UNIQUE INDEX "online_fulfillments_sale_id_key"
  ON "online_fulfillments"("sale_id");
CREATE INDEX "online_fulfillments_branch_id_status_idx"
  ON "online_fulfillments"("branch_id", "status");
CREATE UNIQUE INDEX "online_fulfillment_items_fulfillment_id_product_id_key"
  ON "online_fulfillment_items"("fulfillment_id", "product_id");
CREATE INDEX "online_fulfillment_items_product_id_idx"
  ON "online_fulfillment_items"("product_id");

ALTER TABLE "online_fulfillments"
  ADD CONSTRAINT "online_fulfillments_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "online_fulfillments"
  ADD CONSTRAINT "online_fulfillments_sale_id_fkey"
  FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "online_fulfillment_items"
  ADD CONSTRAINT "online_fulfillment_items_fulfillment_id_fkey"
  FOREIGN KEY ("fulfillment_id") REFERENCES "online_fulfillments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "online_fulfillment_items"
  ADD CONSTRAINT "online_fulfillment_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
