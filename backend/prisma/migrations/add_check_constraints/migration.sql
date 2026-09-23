-- Migration: Add Check Constraints for Business Rules
-- Created: 2024-01-19
-- Purpose: Add database-level check constraints to enforce business rules

-- Sale items constraints
ALTER TABLE sale_items ADD CONSTRAINT chk_sale_items_quantity_positive CHECK (quantity > 0);
ALTER TABLE sale_items ADD CONSTRAINT chk_sale_items_unit_price_positive CHECK (unit_price >= 0);

-- Ledger entries constraints
ALTER TABLE ledger_entries ADD CONSTRAINT chk_ledger_entries_debit_non_negative CHECK (debit >= 0);
ALTER TABLE ledger_entries ADD CONSTRAINT chk_ledger_entries_credit_non_negative CHECK (credit >= 0);

-- Products constraints
ALTER TABLE products ADD CONSTRAINT chk_products_selling_price_positive CHECK (selling_price >= 0);
ALTER TABLE products ADD CONSTRAINT chk_products_cost_price_positive CHECK (cost_price >= 0);

-- Stock balances constraints
ALTER TABLE stock_balances ADD CONSTRAINT chk_stock_balances_quantity_non_negative CHECK (quantity >= 0);

-- Purchase items constraints
ALTER TABLE purchase_items ADD CONSTRAINT chk_purchase_items_quantity_positive CHECK (quantity > 0);
ALTER TABLE purchase_items ADD CONSTRAINT chk_purchase_items_unit_cost_positive CHECK (unit_cost >= 0);

-- Sale return items constraints
ALTER TABLE sale_return_items ADD CONSTRAINT chk_sale_return_items_quantity_positive CHECK (quantity > 0);
ALTER TABLE sale_return_items ADD CONSTRAINT chk_sale_return_items_unit_price_positive CHECK (unit_price >= 0);

-- Stock transfer items constraints
ALTER TABLE stock_transfer_items ADD CONSTRAINT chk_stock_transfer_items_quantity_positive CHECK (quantity > 0);

-- Payment reconciliation constraints
ALTER TABLE payment_reconciliations ADD CONSTRAINT chk_payment_reconciliations_expected_amount_positive CHECK (expected_amount >= 0);
ALTER TABLE payment_reconciliations ADD CONSTRAINT chk_payment_reconciliations_actual_amount_positive CHECK (actual_amount >= 0);
