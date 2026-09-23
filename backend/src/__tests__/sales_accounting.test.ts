import { describe, it, expect } from 'vitest';
import { createSaleSchema } from '../modules/sales/sales.schema.js';
import { createProductSchema } from '../modules/products/products.schema.js';

describe('Phase F & H — Atomic Sales Engine & Double-Entry Accounting', () => {
  it('should validate sale creation payload', () => {
    const validSale = {
      branchId: 'br-main-uuid',
      channel: 'RETAIL' as const,
      discountAmount: 5.00,
      taxAmount: 0,
      items: [
        { productId: 'prod-uuid-1', quantity: 2, unitPrice: 50.00 },
      ],
      payments: [
        { paymentMethod: 'CASH' as const, amount: 95.00 },
      ],
    };

    const parsed = createSaleSchema.parse(validSale);
    expect(parsed.items.length).toBe(1);
    expect(parsed.payments[0].amount).toBe(95.00);
  });

  it('should reject sale payloads with payment amounts mismatch or missing items', () => {
    const invalidSale = {
      branchId: 'br-main-uuid',
      items: [],
      payments: [],
    };

    expect(() => createSaleSchema.parse(invalidSale)).toThrow();
  });

  it('should allow zero loyalty redemption points for ordinary sales', () => {
    const parsed = createSaleSchema.parse({
      branchId: 'br-main-uuid',
      items: [{ productId: 'prod-uuid-1', quantity: 1, unitPrice: 20 }],
      payments: [{ paymentMethod: 'CASH', amount: 20 }],
      loyaltyRedemptionPoints: 0,
    });

    expect(parsed.loyaltyRedemptionPoints).toBe(0);
  });

  it('should allow products to carry opening stock for real inventory validation', () => {
    const parsed = createProductSchema.parse({
      sku: 'NDS-001',
      barcode: '123456789',
      name: 'Noodles',
      categoryId: 'cat-1',
      unitId: 'unit-1',
      costPrice: 12,
      sellingPrice: 20,
      openingStock: 25,
    });

    expect(parsed.openingStock).toBe(25);
  });
});
