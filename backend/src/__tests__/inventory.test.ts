import { describe, it, expect } from 'vitest';
import { stockAdjustmentSchema, createTransferSchema } from '../modules/inventory/inventory.schema.js';

describe('Phase D — Inventory Engine Schemas & Business Rules', () => {
  it('should validate stock adjustment schema', () => {
    const validAdjustment = {
      productId: 'prod-uuid-123',
      locationType: 'WAREHOUSE' as const,
      locationId: 'wh-central-uuid',
      quantity: 50,
      movementType: 'OPENING_STOCK' as const,
      unitCost: 12.50,
      notes: 'Initial stock intake',
    };

    const parsed = stockAdjustmentSchema.parse(validAdjustment);
    expect(parsed.productId).toBe('prod-uuid-123');
    expect(parsed.quantity).toBe(50);
    expect(parsed.movementType).toBe('OPENING_STOCK');
  });

  it('should validate stock transfer creation schema', () => {
    const validTransfer = {
      sourceLocationId: 'wh-central-uuid',
      destinationLocationId: 'br-main-uuid',
      notes: 'Weekly store replenishment',
      items: [
        { productId: 'prod-uuid-1', quantity: 20 },
        { productId: 'prod-uuid-2', quantity: 15 },
      ],
    };

    const parsed = createTransferSchema.parse(validTransfer);
    expect(parsed.items.length).toBe(2);
    expect(parsed.items[0].quantity).toBe(20);
  });

  it('should reject transfers with zero or negative item quantities', () => {
    const invalidTransfer = {
      sourceLocationId: 'wh-central-uuid',
      destinationLocationId: 'br-main-uuid',
      items: [{ productId: 'prod-uuid-1', quantity: 0 }],
    };

    expect(() => createTransferSchema.parse(invalidTransfer)).toThrow();
  });
});
