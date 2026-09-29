import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    product: { findUnique: vi.fn(), update: vi.fn() },
    category: { findFirst: vi.fn() },
    unit: { findFirst: vi.fn() },
  },
}));

vi.mock('../db/prisma.js', () => ({ prisma: prismaMock }));

import { ProductsService } from '../modules/products/products.service.js';

describe('PASALO product catalog synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('PASALO_CATALOG_API_URL', 'https://pasalo.example.test/api/v1/catalog/products');
    vi.stubEnv('PASALO_CATALOG_API_KEY', 'test-read-only-key');
    const item = {
      id: 'pasalo-product-1', skuCode: 'E2E-COKE-500', name: 'Coke 500ml',
      barcode: '1234567890', isActive: true,
      category: { id: 'pasalo-category-1', name: 'Beverages' },
      defaultUnit: { name: 'Bottle', symbol: 'btl' },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { items: [item], total: 1 } }),
    }));
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
    prismaMock.product.findUnique.mockImplementation(async ({ where }: { where: { sku?: string; pasalo_product_id?: string } }) => {
      if (where.pasalo_product_id) return null;
      return { id: 'local-product-1', sku: 'E2E-COKE-500', pasalo_product_id: null };
    });
    prismaMock.category.findFirst.mockResolvedValue({ id: 'local-category-1' });
    prismaMock.unit.findFirst.mockResolvedValue({ id: 'local-unit-1' });
    prismaMock.product.update.mockResolvedValue({ id: 'local-product-1' });
  });

  it('links by SKU, updates in place on replay, and leaves pricing and stock untouched', async () => {
    const first = await ProductsService.syncPasaloCatalog();
    expect(first).toEqual({ synced: 1, linked: 1, updated: 0, unmatched: [] });

    prismaMock.product.findUnique.mockImplementation(async ({ where }: { where: { sku?: string; pasalo_product_id?: string } }) => ({
      id: 'local-product-1', sku: 'E2E-COKE-500', pasalo_product_id: where.pasalo_product_id ? 'pasalo-product-1' : 'pasalo-product-1',
    }));
    const replay = await ProductsService.syncPasaloCatalog();
    expect(replay).toEqual({ synced: 1, linked: 0, updated: 1, unmatched: [] });
    expect(prismaMock.product.update).toHaveBeenCalledTimes(2);
    for (const call of prismaMock.product.update.mock.calls) {
      expect(call[0].data).toMatchObject({ pasalo_product_id: 'pasalo-product-1', sku: 'E2E-COKE-500', name: 'Coke 500ml' });
      expect(call[0].data).not.toHaveProperty('cost_price');
      expect(call[0].data).not.toHaveProperty('selling_price');
      expect(call[0].data).not.toHaveProperty('stock');
    }
  });
});
