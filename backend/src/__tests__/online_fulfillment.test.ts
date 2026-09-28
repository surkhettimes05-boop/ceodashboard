import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, saleMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    onlineFulfillment: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    branch: { findUnique: vi.fn() },
    product: { findUnique: vi.fn() },
    user: { findFirst: vi.fn() },
    idempotencyKey: { findUnique: vi.fn() },
  },
  saleMock: { createSaleTransaction: vi.fn() },
}));

vi.mock('../db/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../modules/sales/sales.service.js', () => ({ SalesService: saleMock }));

import { OnlineFulfillmentService } from '../modules/sync/online-fulfillment.service.js';

describe('online store fulfillment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.onlineFulfillment.findUnique.mockResolvedValue(null);
    prismaMock.branch.findUnique.mockResolvedValue({ id: 'store-1', code: 'STORE1', is_active: true });
    prismaMock.product.findUnique.mockResolvedValue({ id: 'ceo-coke', pasalo_product_id: 'pasalo-coke', cost_price: 10, selling_price: 25, is_active: true });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
    prismaMock.$queryRaw.mockReset();
    prismaMock.$queryRaw.mockResolvedValueOnce([{ quantity: 30 }]).mockResolvedValueOnce([{ quantity: 0 }]);
    prismaMock.onlineFulfillment.create.mockResolvedValue({ id: 'reservation-1', status: 'RESERVED', items: [] });
    prismaMock.onlineFulfillment.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.idempotencyKey.findUnique.mockResolvedValue(null);
  });

  it('routes Store1 and reserves exactly the requested quantity without touching Store2', async () => {
    const result = await OnlineFulfillmentService.reserve({
      externalOrderId: 'commerce-order-1',
      pasaloOrderId: 'pasalo-order-1',
      branchCode: 'STORE1',
      items: [{ productId: 'pasalo-coke', quantity: 2 }],
    });

    expect(result.status).toBe('RESERVED');
    expect(prismaMock.branch.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { code: 'STORE1' } }));
    expect(prismaMock.onlineFulfillment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ branch_id: 'store-1', items: { create: [{ product_id: 'ceo-coke', quantity: 2 }] } }),
    }));
  });

  it('posts one ONLINE sale on completion and replays the same sale safely', async () => {
    const reserved = {
      id: 'reservation-1',
      external_order_id: 'commerce-order-1',
      status: 'RESERVED',
      sale_id: null,
      branch: { id: 'store-1', code: 'STORE1' },
      items: [{ quantity: 2, product: { id: 'ceo-coke', pasalo_product_id: 'pasalo-coke', selling_price: 25 } }],
    };
    prismaMock.onlineFulfillment.findUnique
      .mockResolvedValueOnce(reserved)
      .mockResolvedValueOnce({ ...reserved, status: 'COMPLETED', sale_id: 'sale-1' });
    prismaMock.user.findFirst.mockResolvedValue({ id: 'system-user' });
    prismaMock.onlineFulfillment.update.mockResolvedValue({ ...reserved, status: 'COMPLETED', sale_id: 'sale-1' });
    saleMock.createSaleTransaction.mockResolvedValue({ id: 'sale-1' });

    const first = await OnlineFulfillmentService.complete('commerce-order-1');
    const second = await OnlineFulfillmentService.complete('commerce-order-1');

    expect(first.saleId).toBe('sale-1');
    expect(second.alreadyProcessed).toBe(true);
    expect(saleMock.createSaleTransaction).toHaveBeenCalledTimes(1);
    expect(saleMock.createSaleTransaction).toHaveBeenCalledWith(expect.objectContaining({
      branchId: 'store-1',
      channel: 'ONLINE',
      items: [{ productId: 'ceo-coke', quantity: 2, unitPrice: 25 }],
    }), 'system-user', expect.any(Object), 'online-fulfillment:commerce-order-1');
  });

  it('releases a reservation once when cancellation is repeated', async () => {
    prismaMock.onlineFulfillment.findUnique
      .mockResolvedValueOnce({ id: 'reservation-1', status: 'RESERVED' })
      .mockResolvedValueOnce({ id: 'reservation-1', status: 'CANCELLED' });
    prismaMock.onlineFulfillment.update.mockResolvedValue({ id: 'reservation-1', status: 'CANCELLED' });

    const first = await OnlineFulfillmentService.cancel('commerce-order-1');
    const second = await OnlineFulfillmentService.cancel('commerce-order-1');

    expect(first.status).toBe('CANCELLED');
    expect(second.alreadyProcessed).toBe(true);
    expect(prismaMock.onlineFulfillment.update).toHaveBeenCalledTimes(1);
  });
});
