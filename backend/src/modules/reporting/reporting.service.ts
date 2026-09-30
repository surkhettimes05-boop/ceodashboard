import { PasalhoReportingClient } from './pasalho-reporting.client.js';
import { StoreReportingService } from './store-reporting.service.js';
import { DailyReportingSummary, ReportingMetric } from './reporting.types.js';

const storeReadModel = 'CEO PostgreSQL store sales and stock_balance read model';
const pasalhoReadModel = 'Pasalho reporting API: GET /api/v1/reporting/daily-summary';

function metric<T>(value: T | null, sourceSystem: 'PASALHO' | 'CEO_DASHBOARD' | 'COMBINED', apiOrReadModel: string, calculation: string): ReportingMetric<T> {
  return {
    value,
    status: value === null ? 'unavailable' : 'available',
    provenance: { sourceSystem, apiOrReadModel, calculation },
  };
}

export class ReportingService {
  static async getDailySummary(startDate: Date, endDate: Date, label: string, branchId?: string): Promise<DailyReportingSummary> {
    const store = await StoreReportingService.getDailySummary(startDate, endDate, branchId);
    let pasalho: Awaited<ReturnType<typeof PasalhoReportingClient.getDailySummary>> = null;
    let pasalhoReason: string | undefined;

    try {
      pasalho = await PasalhoReportingClient.getDailySummary(startDate, endDate);
      if (!pasalho) pasalhoReason = 'PASALHO_REPORTING_API_URL is not configured.';
    } catch (error) {
      pasalhoReason = error instanceof Error ? error.message : 'Pasalho reporting API unavailable.';
    }

    const pasalhoAvailable = Boolean(pasalho);
    return {
      period: { startDate: startDate.toISOString(), endDate: endDate.toISOString(), label },
      sales: {
        total: metric(pasalho ? store.sales + pasalho.sales.b2b + pasalho.sales.online + pasalho.sales.franchise : null, 'COMBINED', `${storeReadModel} + ${pasalhoReadModel}`, 'Store sales + Pasalho B2B sales + Pasalho online sales + Pasalho franchise sales.'),
        store: metric(store.sales, 'CEO_DASHBOARD', storeReadModel, 'Sum completed store sales in the selected period.'),
        b2b: metric(pasalho?.sales.b2b ?? null, 'PASALHO', pasalhoReadModel, 'Pasalho-provided B2B sales total.'),
        online: metric(pasalho?.sales.online ?? null, 'PASALHO', pasalhoReadModel, 'Pasalho-provided online sales total.'),
        franchise: metric(pasalho?.sales.franchise ?? null, 'PASALHO', pasalhoReadModel, 'Pasalho-provided franchise sales total.'),
        orderCount: metric(pasalho ? store.orderCount + pasalho.sales.orderCount : null, 'COMBINED', `${storeReadModel} + ${pasalhoReadModel}`, 'Store completed orders + Pasalho order count.'),
        cancelledOrders: metric(pasalho ? store.cancelledOrders + pasalho.sales.cancelledOrders : null, 'COMBINED', `${storeReadModel} + ${pasalhoReadModel}`, 'Store cancelled/voided orders + Pasalho cancelled orders.'),
        byStore: metric(store.byStore, 'CEO_DASHBOARD', storeReadModel, 'Group completed store sales by branch.'),
      },
      inventory: {
        warehouse: metric(pasalho?.inventory.warehouse ?? null, 'PASALHO', pasalhoReadModel, 'Pasalho-provided warehouse inventory snapshot.'),
        store: metric({ totalUnits: store.inventory.totalUnits, productCount: store.inventory.productCount }, 'CEO_DASHBOARD', storeReadModel, 'Sum store stock balances by tracked product.'),
        lowStockProducts: metric(pasalho ? store.inventory.lowStockProducts + pasalho.inventory.lowStockProducts : null, 'COMBINED', `${storeReadModel} + ${pasalhoReadModel}`, 'Store low-stock products + Pasalho warehouse low-stock products.'),
      },
      availability: {
        pasalho: pasalhoAvailable ? 'available' : 'unavailable',
        ...(pasalhoReason ? { reason: pasalhoReason } : {}),
      },
    };
  }
}
