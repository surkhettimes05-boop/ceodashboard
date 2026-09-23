import { describe, it, expect } from 'vitest';
import { createProductSchema } from '../modules/products/products.schema.js';
import { createCustomerSchema } from '../modules/customers/customers.schema.js';
import { createSupplierSchema } from '../modules/suppliers/suppliers.schema.js';

describe('Phase C — Master Data Schemas & Validation', () => {
  it('should validate product creation schema correctly', () => {
    const validProduct = {
      sku: 'PRD-001',
      barcode: '1234567890123',
      name: 'Organic Coffee Beans 1kg',
      categoryId: 'cat-uuid-1',
      unitId: 'unit-uuid-1',
      costPrice: 12.50,
      sellingPrice: 25.00,
      wholesalePrice: 20.00,
      minStockLevel: 10,
    };

    const parsed = createProductSchema.parse(validProduct);
    expect(parsed.sku).toBe('PRD-001');
    expect(parsed.sellingPrice).toBe(25.00);

    // Invalid product with negative cost
    expect(() => {
      createProductSchema.parse({ ...validProduct, costPrice: -5 });
    }).toThrow();
  });

  it('should validate customer creation schema for retail and B2B', () => {
    const b2bCustomer = {
      code: 'CUST-B2B-01',
      name: 'Acme Supermarket Chain',
      email: 'procurement@acme.com',
      isB2b: true,
      creditLimit: 50000,
    };

    const parsed = createCustomerSchema.parse(b2bCustomer);
    expect(parsed.isB2b).toBe(true);
    expect(parsed.creditLimit).toBe(50000);
  });

  it('should validate supplier schema', () => {
    const supplier = {
      name: 'Global Beverage Wholesalers Ltd',
      phone: '+1 800-555-0199',
      email: 'orders@globalbev.com',
    };

    const parsed = createSupplierSchema.parse(supplier);
    expect(parsed.name).toBe('Global Beverage Wholesalers Ltd');
  });
});
