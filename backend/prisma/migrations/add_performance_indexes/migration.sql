-- Migration: Add Performance Indexes
-- Created: 2024-01-19
-- Purpose: Add indexes for frequently queried fields to improve query performance

-- Add receivables fields required by the current customer and supplier models.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_hold BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS aging_0_30 DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS aging_31_60 DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS aging_61_90 DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS aging_90_plus DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS collection_status VARCHAR(50);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS outstanding_balance DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS aging_0_30 DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS aging_31_60 DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS aging_61_90 DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS aging_90_plus DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER NOT NULL DEFAULT 30;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP;

-- Sales table indexes
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_branch_id ON sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_cashier_id ON sales(cashier_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);

-- Journal entries table indexes
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference ON journal_entries(reference_type, reference_id);

-- Ledger entries table indexes
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_id ON ledger_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_journal_entry_id ON ledger_entries(journal_entry_id);

-- Inventory transactions table indexes
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_product_id ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created_at ON inventory_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_reference ON inventory_transactions(reference_type, reference_id);

-- Audit logs table indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Stock balances table indexes
CREATE INDEX IF NOT EXISTS idx_stock_balances_location_id ON stock_balances(location_id);

-- Customers table indexes
CREATE INDEX IF NOT EXISTS idx_customers_credit_hold ON customers(credit_hold);
CREATE INDEX IF NOT EXISTS idx_customers_collection_status ON customers(collection_status);

-- Suppliers table indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_payment_terms ON suppliers(payment_terms_days);

-- Partial indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_products_active ON products(id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_open ON fiscal_periods(id) WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS idx_payment_reconciliations_pending ON payment_reconciliations(id) WHERE status = 'PENDING';
