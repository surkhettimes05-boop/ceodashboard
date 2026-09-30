import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/index.js', () => ({
  config: {
    pasalhoReportingApiUrl: 'https://pasalho.example.test',
    pasalhoReportingApiToken: 'reporting-secret',
  },
}));

import { PasalhoReportingClient } from './pasalho-reporting.client.js';

describe('CEO to PASALHO reporting contract', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('calls the versioned PASALHO route with the shared token and franchise schema', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: {
        sales: { b2b: 5, online: 2, franchise: 10, orderCount: 3, cancelledOrders: 0 },
        inventory: { warehouse: { totalUnits: 63, productCount: 1 }, lowStockProducts: 0 },
      } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await PasalhoReportingClient.getDailySummary(
      new Date('2026-09-30T00:00:00Z'),
      new Date('2026-10-01T00:00:00Z'),
    );

    expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/api/v1/reporting/daily-summary');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: 'Bearer reporting-secret', Accept: 'application/json' },
    });
    expect(result?.sales.franchise).toBe(10);
  });
});
