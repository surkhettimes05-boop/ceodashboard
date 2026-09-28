-- These legacy additive migrations sort after timestamped migrations in
-- Prisma's migration order, but 20260920042127_sync_schema expects their
-- schema to exist. Apply their idempotent operations here first so a clean
-- database can reach the sync migration without changing historical files.

-- Prerequisites from add_loyalty_system.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_points_balance DECIMAL(12,0) DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lifetime_spend DECIMAL(12,2) DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS first_purchase_at TIMESTAMP;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_purchase_at TIMESTAMP;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS date_of_birth TIMESTAMP;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS gender VARCHAR(50);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';
CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_unique ON customers(phone) WHERE phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS loyalty_settings (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  points_per_currency DECIMAL(12,0) DEFAULT 1,
  currency_per_point DECIMAL(12,2) DEFAULT 100,
  minimum_redeem_points INTEGER DEFAULT 100,
  points_value DECIMAL(12,2) DEFAULT 1,
  active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO loyalty_settings (id, points_per_currency, currency_per_point, points_value, minimum_redeem_points, active, updated_at)
VALUES ('default-loyalty-settings', 1, 100, 1, 100, true, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id VARCHAR(36) NOT NULL,
  sale_id VARCHAR(36),
  type VARCHAR(50) NOT NULL,
  points DECIMAL(12,0) NOT NULL,
  balance_after DECIMAL(12,0) NOT NULL,
  description TEXT NOT NULL,
  created_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS loyalty_transactions_customer_id_idx ON loyalty_transactions(customer_id);
CREATE INDEX IF NOT EXISTS loyalty_transactions_sale_id_idx ON loyalty_transactions(sale_id);

CREATE TABLE IF NOT EXISTS feedbacks (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id VARCHAR(36) NOT NULL,
  customer_id VARCHAR(36),
  store_id VARCHAR(36) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  category VARCHAR(100) NOT NULL,
  comment TEXT,
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (store_id) REFERENCES branches(id)
);
CREATE INDEX IF NOT EXISTS feedbacks_customer_id_idx ON feedbacks(customer_id);
CREATE INDEX IF NOT EXISTS feedbacks_transaction_id_idx ON feedbacks(transaction_id);
CREATE INDEX IF NOT EXISTS feedbacks_store_id_idx ON feedbacks(store_id);

CREATE TABLE IF NOT EXISTS complaints (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id VARCHAR(36),
  transaction_id VARCHAR(36),
  store_id VARCHAR(36) NOT NULL,
  category VARCHAR(100) NOT NULL,
  priority VARCHAR(20) DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  description TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  assigned_to VARCHAR(36),
  resolution TEXT,
  resolved_at TIMESTAMP,
  closed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (transaction_id) REFERENCES sales(id) ON DELETE SET NULL,
  FOREIGN KEY (store_id) REFERENCES branches(id)
);
CREATE INDEX IF NOT EXISTS complaints_customer_id_idx ON complaints(customer_id);
CREATE INDEX IF NOT EXISTS complaints_store_id_idx ON complaints(store_id);
CREATE INDEX IF NOT EXISTS complaints_status_idx ON complaints(status);
CREATE INDEX IF NOT EXISTS sales_customer_id_idx ON sales(customer_id) WHERE customer_id IS NOT NULL;

-- Prerequisites from add_mfa_fields.
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_backup_codes TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_verified_at TIMESTAMP;

-- Prerequisites from add_performance_indexes.
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

CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_branch_id ON sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_cashier_id ON sales(cashier_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference ON journal_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_id ON ledger_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_journal_entry_id ON ledger_entries(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_product_id ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created_at ON inventory_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_reference ON inventory_transactions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_balances_location_id ON stock_balances(location_id);
CREATE INDEX IF NOT EXISTS idx_customers_credit_hold ON customers(credit_hold);
CREATE INDEX IF NOT EXISTS idx_customers_collection_status ON customers(collection_status);
CREATE INDEX IF NOT EXISTS idx_suppliers_payment_terms ON suppliers(payment_terms_days);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_open ON fiscal_periods(id) WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS idx_payment_reconciliations_pending ON payment_reconciliations(id) WHERE status = 'PENDING';
