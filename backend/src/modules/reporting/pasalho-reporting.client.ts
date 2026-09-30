import { config } from '../../config/index.js';

export interface PasalhoDailySummary {
  sales: {
    b2b: number;
    online: number;
    franchise: number;
    orderCount: number;
    cancelledOrders: number;
  };
  inventory: {
    warehouse: { totalUnits: number; productCount: number };
    lowStockProducts: number;
  };
}

export class PasalhoReportingClient {
  static async getDailySummary(startDate: Date, endDate: Date): Promise<PasalhoDailySummary | null> {
    if (!config.pasalhoReportingApiUrl) {
      return null;
    }

    const url = new URL('/api/v1/reporting/daily-summary', config.pasalhoReportingApiUrl);
    url.searchParams.set('startDate', startDate.toISOString());
    url.searchParams.set('endDate', endDate.toISOString());

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(config.pasalhoReportingApiToken ? { Authorization: `Bearer ${config.pasalhoReportingApiToken}` } : {}),
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Pasalho reporting API returned HTTP ${response.status}`);
    }

    const body = await response.json() as { data?: PasalhoDailySummary };
    if (!body.data) {
      throw new Error('Pasalho reporting API returned an invalid daily summary');
    }

    return body.data;
  }
}
