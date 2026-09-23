# DATABASE SCHEMA & ENTITY DESIGN (POSTGRESQL / PRISMA)

## Executive Summary
This document defines the relational PostgreSQL database architecture and entity relationship design for our startup ERP, POS, Inventory, and Accounting system. The schema enforces strict transactional integrity, multi-branch data scoping, immutable double-entry accounting records, and auditable stock transaction logs.

---

## 1. Entity Relationship Overview

```
                      +-------------------+
                      |      branches     |
                      +---------+---------+
                                |
             +------------------+------------------+
             |                                     |
   +---------v---------+                 +---------v---------+
   |    warehouses     |                 |       users       |
   +---------+---------+                 +---------+---------+
             |                                     |
+------------v------------+              +---------v---------+
|     stock_balances      |              |       roles       |
+------------+------------+              +-------------------+
             |
+------------v------------+
| inventory_transactions  | <----+
+------------+------------+      |
             |                   |
             +-------------------+-------------------+
             |                                       |
   +---------v---------+                   +---------v---------+
   |     products      |                   |       sales       |
   +---------+---------+                   +---------+---------+
             |                                       |
   +---------v---------+                   +---------v---------+
   |    categories     |                   |    sale_items     |
   +-------------------+                   +---------+---------+
                                                     |
                                           +---------v---------+
                                           |  ledger_entries   |
                                           +-------------------+
```

---

## 2. Enumerations

```prisma
enum RoleType {
  CEO
  ADMIN
  MANAGER
  WAREHOUSE_MANAGER
  CASHIER
  ACCOUNTANT
  B2B_SALES
  PURCHASING
}

enum SalesChannel {
  RETAIL
  B2B
  ONLINE
}

enum PaymentMethod {
  CASH
  CARD
  MOBILE_MONEY
  BANK_TRANSFER
  CREDIT
}

enum InventoryMovementType {
  SALE
  PURCHASE
  TRANSFER_IN
  TRANSFER_OUT
  RETURN
  ADJUSTMENT
  DAMAGE
  OPENING_STOCK
}

enum AccountType {
  ASSET
  LIABILITY
  EQUITY
  REVENUE
  EXPENSE
}

enum TransferStatus {
  PENDING
  IN_TRANSIT
  COMPLETED
  CANCELLED
}

enum PurchaseStatus {
  DRAFT
  ORDERED
  RECEIVED
  CANCELLED
}
```

---

## 3. Core Database Table Definitions

### 3.1 Authentication & RBAC

#### `users`
- `id` (UUID, Primary Key)
- `username` (VARCHAR(50), Unique)
- `email` (VARCHAR(100), Unique)
- `password_hash` (VARCHAR(255))
- `full_name` (VARCHAR(100))
- `role_id` (UUID, Foreign Key -> `roles.id`)
- `branch_id` (UUID, Nullable, Foreign Key -> `branches.id`)
- `is_active` (BOOLEAN, Default true)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

#### `roles`
- `id` (UUID, Primary Key)
- `name` (RoleType, Unique)
- `description` (TEXT)

#### `permissions`
- `id` (UUID, Primary Key)
- `code` (VARCHAR(100), Unique, e.g. `sales:create`, `accounting:post`)
- `module` (VARCHAR(50))
- `description` (TEXT)

#### `role_permissions`
- `role_id` (UUID, Foreign Key -> `roles.id`)
- `permission_id` (UUID, Foreign Key -> `permissions.id`)
- **Primary Key:** (`role_id`, `permission_id`)

---

### 3.2 Organization & Master Data

#### `branches`
- `id` (UUID, Primary Key)
- `code` (VARCHAR(20), Unique)
- `name` (VARCHAR(100))
- `address` (TEXT)
- `phone` (VARCHAR(20))
- `is_active` (BOOLEAN, Default true)
- `created_at` (TIMESTAMP)

#### `warehouses`
- `id` (UUID, Primary Key)
- `code` (VARCHAR(20), Unique)
- `name` (VARCHAR(100))
- `branch_id` (UUID, Nullable, Foreign Key -> `branches.id`)
- `is_central` (BOOLEAN, Default false)
- `created_at` (TIMESTAMP)

---

### 3.3 Catalog & Products

#### `categories`
- `id` (UUID, Primary Key)
- `name` (VARCHAR(100), Unique)
- `description` (TEXT)

#### `units`
- `id` (UUID, Primary Key)
- `name` (VARCHAR(50)) -- e.g., Piece, Pack, Box, Carton
- `abbreviation` (VARCHAR(10))

#### `products`
- `id` (UUID, Primary Key)
- `sku` (VARCHAR(50), Unique)
- `barcode` (VARCHAR(50), Unique, Nullable)
- `name` (VARCHAR(150))
- `category_id` (UUID, Foreign Key -> `categories.id`)
- `unit_id` (UUID, Foreign Key -> `units.id`)
- `cost_price` (DECIMAL(12, 2))
- `selling_price` (DECIMAL(12, 2))
- `wholesale_price` (DECIMAL(12, 2), Nullable)
- `min_stock_level` (INT, Default 5)
- `is_active` (BOOLEAN, Default true)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

---

### 3.4 Inventory & Stock Audit Engine

#### `stock_balances`
- `id` (UUID, Primary Key)
- `product_id` (UUID, Foreign Key -> `products.id`)
- `location_type` (VARCHAR(20)) -- WAREHOUSE or BRANCH
- `location_id` (UUID) -- Reference to warehouse.id or branch.id
- `quantity` (DECIMAL(12, 3), Default 0)
- `updated_at` (TIMESTAMP)
- **Constraint:** Unique (`product_id`, `location_id`)

#### `inventory_transactions`
- `id` (UUID, Primary Key)
- `product_id` (UUID, Foreign Key -> `products.id`)
- `location_type` (VARCHAR(20)) -- WAREHOUSE or BRANCH
- `location_id` (UUID)
- `movement_type` (InventoryMovementType)
- `quantity` (DECIMAL(12, 3)) -- Positive for IN, Negative for OUT
- `unit_cost` (DECIMAL(12, 2))
- `reference_type` (VARCHAR(50)) -- SALE, PURCHASE, TRANSFER, RETURN, ADJUSTMENT
- `reference_id` (UUID)
- `user_id` (UUID, Foreign Key -> `users.id`)
- `notes` (TEXT)
- `created_at` (TIMESTAMP)

#### `stock_transfers`
- `id` (UUID, Primary Key)
- `transfer_number` (VARCHAR(50), Unique)
- `source_location_id` (UUID)
- `destination_location_id` (UUID)
- `status` (TransferStatus, Default PENDING)
- `notes` (TEXT)
- `created_by` (UUID, Foreign Key -> `users.id`)
- `created_at` (TIMESTAMP)

#### `stock_transfer_items`
- `id` (UUID, Primary Key)
- `transfer_id` (UUID, Foreign Key -> `stock_transfers.id`)
- `product_id` (UUID, Foreign Key -> `products.id`)
- `quantity` (DECIMAL(12, 3))

---

### 3.5 Sales Engine & POS

#### `customers`
- `id` (UUID, Primary Key)
- `code` (VARCHAR(50), Unique)
- `name` (VARCHAR(100))
- `phone` (VARCHAR(20))
- `email` (VARCHAR(100))
- `is_b2b` (BOOLEAN, Default false)
- `credit_limit` (DECIMAL(12, 2), Default 0)
- `outstanding_balance` (DECIMAL(12, 2), Default 0)
- `created_at` (TIMESTAMP)

#### `sales`
- `id` (UUID, Primary Key)
- `sale_number` (VARCHAR(50), Unique) -- e.g. SAL-20260918-0001
- `branch_id` (UUID, Foreign Key -> `branches.id`)
- `cashier_id` (UUID, Foreign Key -> `users.id`)
- `customer_id` (UUID, Nullable, Foreign Key -> `customers.id`)
- `channel` (SalesChannel, Default RETAIL)
- `subtotal` (DECIMAL(12, 2))
- `discount_amount` (DECIMAL(12, 2), Default 0)
- `tax_amount` (DECIMAL(12, 2), Default 0)
- `total_amount` (DECIMAL(12, 2))
- `created_at` (TIMESTAMP)

#### `sale_items`
- `id` (UUID, Primary Key)
- `sale_id` (UUID, Foreign Key -> `sales.id`)
- `product_id` (UUID, Foreign Key -> `products.id`)
- `quantity` (DECIMAL(12, 3))
- `unit_price` (DECIMAL(12, 2))
- `unit_cost` (DECIMAL(12, 2)) -- Captured at time of sale for accurate COGS
- `subtotal` (DECIMAL(12, 2))

#### `sale_payments`
- `id` (UUID, Primary Key)
- `sale_id` (UUID, Foreign Key -> `sales.id`)
- `payment_method` (PaymentMethod)
- `amount` (DECIMAL(12, 2))
- `reference_code` (VARCHAR(100))
- `created_at` (TIMESTAMP)

---

### 3.6 Double-Entry Accounting System

#### `accounts` (Chart of Accounts)
- `id` (UUID, Primary Key)
- `code` (VARCHAR(20), Unique) -- e.g. 1010 Cash, 4010 Sales Revenue, 5010 COGS
- `name` (VARCHAR(100))
- `type` (AccountType)
- `description` (TEXT)
- `is_active` (BOOLEAN, Default true)

#### `journal_entries`
- `id` (UUID, Primary Key)
- `entry_number` (VARCHAR(50), Unique) -- e.g. JE-20260918-0001
- `date` (DATE)
- `reference_type` (VARCHAR(50)) -- SALE, PURCHASE, EXPENSE, PAYMENT, ADJUSTMENT
- `reference_id` (UUID)
- `description` (TEXT)
- `created_by` (UUID, Foreign Key -> `users.id`)
- `created_at` (TIMESTAMP)

#### `ledger_entries`
- `id` (UUID, Primary Key)
- `journal_entry_id` (UUID, Foreign Key -> `journal_entries.id`)
- `account_id` (UUID, Foreign Key -> `accounts.id`)
- `debit` (DECIMAL(12, 2), Default 0)
- `credit` (DECIMAL(12, 2), Default 0)
- `created_at` (TIMESTAMP)

---

### 3.7 Purchasing & Suppliers

#### `suppliers`
- `id` (UUID, Primary Key)
- `name` (VARCHAR(100))
- `contact_person` (VARCHAR(100))
- `phone` (VARCHAR(20))
- `email` (VARCHAR(100))
- `address` (TEXT)
- `created_at` (TIMESTAMP)

#### `purchases`
- `id` (UUID, Primary Key)
- `purchase_number` (VARCHAR(50), Unique)
- `supplier_id` (UUID, Foreign Key -> `suppliers.id`)
- `warehouse_id` (UUID, Foreign Key -> `warehouses.id`)
- `status` (PurchaseStatus, Default DRAFT)
- `total_amount` (DECIMAL(12, 2))
- `created_by` (UUID, Foreign Key -> `users.id`)
- `created_at` (TIMESTAMP)

#### `purchase_items`
- `id` (UUID, Primary Key)
- `purchase_id` (UUID, Foreign Key -> `purchases.id`)
- `product_id` (UUID, Foreign Key -> `products.id`)
- `quantity` (DECIMAL(12, 3))
- `unit_cost` (DECIMAL(12, 2))
- `subtotal` (DECIMAL(12, 2))

---

### 3.8 Expenses & Audit Trail

#### `expense_categories`
- `id` (UUID, Primary Key)
- `name` (VARCHAR(100))
- `account_id` (UUID, Foreign Key -> `accounts.id`)

#### `expenses`
- `id` (UUID, Primary Key)
- `expense_number` (VARCHAR(50), Unique)
- `category_id` (UUID, Foreign Key -> `expense_categories.id`)
- `branch_id` (UUID, Foreign Key -> `branches.id`)
- `amount` (DECIMAL(12, 2))
- `payment_method` (PaymentMethod)
- `notes` (TEXT)
- `user_id` (UUID, Foreign Key -> `users.id`)
- `created_at` (TIMESTAMP)

#### `audit_logs`
- `id` (UUID, Primary Key)
- `user_id` (UUID, Nullable, Foreign Key -> `users.id`)
- `action` (VARCHAR(100)) -- e.g., SALE_CREATED, STOCK_ADJUSTED, LEDGER_POSTED
- `entity` (VARCHAR(50)) -- e.g., Sale, Product, InventoryTransaction
- `entity_id` (UUID)
- `old_values` (JSONB, Nullable)
- `new_values` (JSONB, Nullable)
- `ip_address` (VARCHAR(45), Nullable)
- `created_at` (TIMESTAMP)
