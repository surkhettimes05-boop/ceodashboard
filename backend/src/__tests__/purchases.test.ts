import { describe, it, expect } from 'vitest';
import { createPurchaseSchema } from '../modules/purchases/purchases.schema.js';

describe('Phase E — Purchasing & Purchase Orders', () => {
  it('should validate purchase order creation schema', () => {
    const validPO = {
      supplierId: 'supplier-uuid-1',
      warehouseId: 'wh-central-uuid',
      items: [
        { productId: 'prod-uuid-1', quantity: 100, unitCost: 10.50 },
        { productId: 'prod-uuid-2', quantity: 50, unitCost: 22.00 },
      ],
    };

    const parsed = createPurchaseSchema.parse(validPO);
    expect(parsed.items.length).toBe(2);
    expect(parsed.items[0].quantity).toBe(100);
    expect(parsed.items[0].unitCost).toBe(10.50);
  });

  it('should reject purchase orders with empty items list', () => {
    const invalidPO = {
      supplierId: 'supplier-uuid-1',
      warehouseId: 'wh-central-uuid',
      items: [],
    };

    expect(() => createPurchaseSchema.parse(invalidPO)).toThrow();
  });
});
