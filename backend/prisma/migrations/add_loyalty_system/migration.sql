-- Migration: Add Loyalty System
-- Created: 2024-01-19
-- Purpose: Add customer loyalty, feedback, and complaint system

-- Add loyalty fields to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_points_balance DECIMAL(12,0) DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lifetime_spend DECIMAL(12,2) DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS first_purchase_at TIMESTAMP;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_purchase_at TIMESTAMP;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS date_of_birth TIMESTAMP;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS gender VARCHAR(50);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';

-- Add unique constraint on phone (allowing nulls)
-- Note: PostgreSQL unique constraints treat NULL as distinct, so multiple nulls are allowed
CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_unique ON customers(phone) WHERE phone IS NOT NULL;

-- Create loyalty_settings table
CREATE TABLE IF NOT EXISTS loyalty_settings (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  points_per_currency DECIMAL(12,0) DEFAULT 1,
  currency_per_point DECIMAL(12,2) DEFAULT 100,
  minimum_redeem_points INTEGER DEFAULT 100,
  points_value DECIMAL(12,2) DEFAULT 1,
  active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default loyalty settings
INSERT INTO loyalty_settings (id, points_per_currency, currency_per_point, minimum_redeem_points, points_value, active)
VALUES ('default-loyalty-settings', 1, 100, 100, 1, true)
ON CONFLICT (id) DO NOTHING;

-- Create loyalty_transactions table
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

-- Create indexes for loyalty_transactions
CREATE INDEX IF NOT EXISTS loyalty_transactions_customer_id_idx ON loyalty_transactions(customer_id);
CREATE INDEX IF NOT EXISTS loyalty_transactions_sale_id_idx ON loyalty_transactions(sale_id);

-- Create feedbacks table
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

-- Create indexes for feedbacks
CREATE INDEX IF NOT EXISTS feedbacks_customer_id_idx ON feedbacks(customer_id);
CREATE INDEX IF NOT EXISTS feedbacks_transaction_id_idx ON feedbacks(transaction_id);
CREATE INDEX IF NOT EXISTS feedbacks_store_id_idx ON feedbacks(store_id);

-- Create complaints table
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

-- Create indexes for complaints
CREATE INDEX IF NOT EXISTS complaints_customer_id_idx ON complaints(customer_id);
CREATE INDEX IF NOT EXISTS complaints_store_id_idx ON complaints(store_id);
CREATE INDEX IF NOT EXISTS complaints_status_idx ON complaints(status);

-- Create index on sales.customer_id for loyalty queries
CREATE INDEX IF NOT EXISTS sales_customer_id_idx ON sales(customer_id) WHERE customer_id IS NOT NULL;
