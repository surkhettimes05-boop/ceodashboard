ALTER TABLE "products" ADD COLUMN "pasalo_product_id" TEXT;

CREATE UNIQUE INDEX "products_pasalo_product_id_key" ON "products"("pasalo_product_id");