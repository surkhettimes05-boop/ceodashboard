/*
  Warnings:

  - The primary key for the `complaints` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `priority` column on the `complaints` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `complaints` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `feedbacks` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `loyalty_settings` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `loyalty_transactions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[phone]` on the table `customers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sale_id]` on the table `loyalty_transactions` will be added. If there are existing duplicate values, this will fail.
  - Made the column `created_at` on table `complaints` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `complaints` required. This step will fail if there are existing NULL values in that column.
  - Made the column `loyalty_points_balance` on table `customers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `lifetime_spend` on table `customers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `total_orders` on table `customers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `status` on table `customers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `feedbacks` required. This step will fail if there are existing NULL values in that column.
  - Made the column `points_per_currency` on table `loyalty_settings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `currency_per_point` on table `loyalty_settings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `minimum_redeem_points` on table `loyalty_settings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `points_value` on table `loyalty_settings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `active` on table `loyalty_settings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `loyalty_settings` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `type` on the `loyalty_transactions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `created_at` on table `loyalty_transactions` required. This step will fail if there are existing NULL values in that column.
  - Made the column `mfa_enabled` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "OfflineQueueStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED', 'CONFLICT');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('SYNCED', 'PENDING', 'FAILED');

-- CreateEnum
CREATE TYPE "LoyaltyTransactionType" AS ENUM ('EARN', 'REDEEM', 'ADJUSTMENT', 'EXPIRE', 'REVERSAL', 'REFUND_REVERSAL');

-- CreateEnum
CREATE TYPE "ComplaintPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- DropForeignKey
ALTER TABLE "complaints" DROP CONSTRAINT "complaints_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "complaints" DROP CONSTRAINT "complaints_store_id_fkey";

-- DropForeignKey
ALTER TABLE "complaints" DROP CONSTRAINT "complaints_transaction_id_fkey";

-- DropForeignKey
ALTER TABLE "feedbacks" DROP CONSTRAINT "feedbacks_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "feedbacks" DROP CONSTRAINT "feedbacks_store_id_fkey";

-- DropForeignKey
ALTER TABLE "feedbacks" DROP CONSTRAINT "feedbacks_transaction_id_fkey";

-- DropForeignKey
ALTER TABLE "loyalty_transactions" DROP CONSTRAINT "loyalty_transactions_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "loyalty_transactions" DROP CONSTRAINT "loyalty_transactions_sale_id_fkey";

-- DropIndex
DROP INDEX "idx_audit_logs_action";

-- DropIndex
DROP INDEX "idx_audit_logs_created_at";

-- DropIndex
DROP INDEX "idx_audit_logs_entity";

-- DropIndex
DROP INDEX "idx_audit_logs_user_id";

-- DropIndex
DROP INDEX "idx_customers_collection_status";

-- DropIndex
DROP INDEX "idx_customers_credit_hold";

-- DropIndex
DROP INDEX "idx_inventory_transactions_created_at";

-- DropIndex
DROP INDEX "idx_inventory_transactions_product_id";

-- DropIndex
DROP INDEX "idx_inventory_transactions_reference";

-- DropIndex
DROP INDEX "idx_journal_entries_date";

-- DropIndex
DROP INDEX "idx_journal_entries_reference";

-- DropIndex
DROP INDEX "idx_journal_entries_status";

-- DropIndex
DROP INDEX "idx_ledger_entries_account_id";

-- DropIndex
DROP INDEX "idx_ledger_entries_journal_entry_id";

-- DropIndex
DROP INDEX "idx_sales_branch_id";

-- DropIndex
DROP INDEX "idx_sales_cashier_id";

-- DropIndex
DROP INDEX "idx_sales_created_at";

-- DropIndex
DROP INDEX "idx_sales_customer_id";

-- DropIndex
DROP INDEX "idx_sales_status";

-- DropIndex
DROP INDEX "idx_stock_balances_location_id";

-- DropIndex
DROP INDEX "idx_suppliers_payment_terms";

-- AlterTable
ALTER TABLE "complaints" DROP CONSTRAINT "complaints_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "ticket_number" SET DATA TYPE TEXT,
ALTER COLUMN "customer_id" SET DATA TYPE TEXT,
ALTER COLUMN "transaction_id" SET DATA TYPE TEXT,
ALTER COLUMN "store_id" SET DATA TYPE TEXT,
ALTER COLUMN "category" SET DATA TYPE TEXT,
DROP COLUMN "priority",
ADD COLUMN     "priority" "ComplaintPriority" NOT NULL DEFAULT 'MEDIUM',
DROP COLUMN "status",
ADD COLUMN     "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
ALTER COLUMN "assigned_to" SET DATA TYPE TEXT,
ALTER COLUMN "resolved_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "closed_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET NOT NULL,
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "complaints_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "customers" ALTER COLUMN "loyalty_points_balance" SET NOT NULL,
ALTER COLUMN "lifetime_spend" SET NOT NULL,
ALTER COLUMN "total_orders" SET NOT NULL,
ALTER COLUMN "first_purchase_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "last_purchase_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "date_of_birth" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "gender" SET DATA TYPE TEXT,
ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "status" SET DATA TYPE TEXT,
ALTER COLUMN "collection_status" SET DATA TYPE TEXT,
ALTER COLUMN "last_payment_date" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "feedbacks" DROP CONSTRAINT "feedbacks_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "transaction_id" SET DATA TYPE TEXT,
ALTER COLUMN "customer_id" SET DATA TYPE TEXT,
ALTER COLUMN "store_id" SET DATA TYPE TEXT,
ALTER COLUMN "category" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "loyalty_settings" DROP CONSTRAINT "loyalty_settings_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "points_per_currency" SET NOT NULL,
ALTER COLUMN "currency_per_point" SET NOT NULL,
ALTER COLUMN "minimum_redeem_points" SET NOT NULL,
ALTER COLUMN "points_value" SET NOT NULL,
ALTER COLUMN "active" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL,
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "loyalty_settings_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "loyalty_transactions" DROP CONSTRAINT "loyalty_transactions_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "customer_id" SET DATA TYPE TEXT,
ALTER COLUMN "sale_id" SET DATA TYPE TEXT,
DROP COLUMN "type",
ADD COLUMN     "type" "LoyaltyTransactionType" NOT NULL,
ALTER COLUMN "created_by" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "suppliers" ALTER COLUMN "last_payment_date" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "mfa_enabled" SET NOT NULL,
ALTER COLUMN "mfa_verified_at" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "offline_queue" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "operation_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OfflineQueueStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced_at" TIMESTAMP(3),
    "conflict_resolution" TEXT,

    CONSTRAINT "offline_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_syncs" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "last_sync_at" TIMESTAMP(3),
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "pending_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "response_body" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PROCESSED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_syncs_device_id_key" ON "device_syncs"("device_id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_key" ON "idempotency_keys"("key");

-- CreateIndex
CREATE INDEX "idempotency_keys_key_expires_at_idx" ON "idempotency_keys"("key", "expires_at");

-- CreateIndex
CREATE INDEX "complaints_status_idx" ON "complaints"("status");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_transactions_sale_id_key" ON "loyalty_transactions"("sale_id");

-- AddForeignKey
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
