import { describe, expect, it, vi } from 'vitest';
import { InventoryController } from '../../src/modules/inventory/inventory.controller.js';

function responseRecorder() {
  const response: any = { statusCode: 200, body: undefined };
  response.status = (statusCode: number) => { response.statusCode = statusCode; return response; };
  response.json = (body: unknown) => { response.body = body; return response; };
  return response;
}

describe('Store inventory API isolation', () => {
  const storeOneUser = { id: 'cashier-1', username: 'store1', email: 'store1@example.test', role: 'CASHIER', permissions: ['inventory:view', 'inventory:adjust'], branchId: 'store-1' };

  it('blocks access to another store stock balances on the server', async () => {
    const response = responseRecorder();
    await InventoryController.getBalances({ user: storeOneUser, query: { locationId: 'store-2' } } as any, response);
    expect(response.statusCode).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it('blocks cross-store adjustments before any inventory service call', async () => {
    const response = responseRecorder();
    const serviceSpy = vi.spyOn((await import('../../src/modules/inventory/inventory.service.js')).InventoryService, 'createStockAdjustment');
    await InventoryController.createAdjustment({ user: storeOneUser, body: { productId: 'product-1', locationType: 'BRANCH', locationId: 'store-2', quantity: 2, movementType: 'ADJUSTMENT' } } as any, response);
    expect(response.statusCode).toBe(403);
    expect(serviceSpy).not.toHaveBeenCalled();
    serviceSpy.mockRestore();
  });
});
