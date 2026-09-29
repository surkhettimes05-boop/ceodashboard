export type ReportingSourceSystem = 'PASALHO' | 'CEO_DASHBOARD' | 'COMBINED';

export interface MetricProvenance {
  sourceSystem: ReportingSourceSystem;
  apiOrReadModel: string;
  calculation: string;
}

export interface ReportingMetric<T> {
  value: T | null;
  provenance: MetricProvenance;
  status: 'available' | 'unavailable';
}

export interface DailyReportingSummary {
  period: {
    startDate: string;
    endDate: string;
    label: string;
  };
  sales: {
    total: ReportingMetric<number>;
    store: ReportingMetric<number>;
    b2b: ReportingMetric<number>;
    online: ReportingMetric<number>;
    orderCount: ReportingMetric<number>;
    cancelledOrders: ReportingMetric<number>;
    byStore: ReportingMetric<Array<{ storeName: string; sales: number; orders: number }>>;
  };
  inventory: {
    warehouse: ReportingMetric<{ totalUnits: number; productCount: number }>;
    store: ReportingMetric<{ totalUnits: number; productCount: number }>;
    lowStockProducts: ReportingMetric<number>;
  };
  availability: {
    pasalho: 'available' | 'unavailable';
    reason?: string;
  };
}