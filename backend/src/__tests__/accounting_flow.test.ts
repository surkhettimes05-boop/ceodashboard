import { describe, expect, it } from 'vitest';
import { AccountingService } from '../modules/accounting/accounting.service.js';
import { AnalyticsService } from '../modules/analytics/analytics.service.js';
import { InventoryService } from '../modules/inventory/inventory.service.js';

describe('Accounting integrity checks', () => {
  it('calculates inventory asset value from quantity × unit cost', () => {
    const valuation = InventoryService.calculateInventoryValue([
      { quantity: 10, unitCost: 100 },
      { quantity: 2, unitCost: 50 },
    ] as any[]);

    expect(valuation).toBe(1100);
  });

  it('calculates gross profit and operating profit from actual transactional values', () => {
    const metrics = AccountingService.calculateFinancialMetrics({
      revenue: 300,
      cogs: 200,
      operatingExpenses: 50,
    });

    expect(metrics.grossProfit).toBe(100);
    expect(metrics.operatingProfit).toBe(50);
    expect(metrics.grossMargin).toBeCloseTo(33.333333, 5);
  });

  it('maps payment methods and sales channels to the correct accounting accounts', () => {
    expect(AccountingService.resolvePaymentAccountCode('CASH')).toBe('1010');
    expect(AccountingService.resolvePaymentAccountCode('CARD')).toBe('1020');
    expect(AccountingService.resolvePaymentAccountCode('CREDIT')).toBe('1030');
    expect(AccountingService.resolveRevenueAccountCode('RETAIL')).toBe('4010');
    expect(AccountingService.resolveRevenueAccountCode('B2B')).toBe('4020');
  });

  it('supports standard dashboard date ranges', () => {
    const result = AnalyticsService.resolveDateRange('last_month');

    expect(result.startDate).toBeInstanceOf(Date);
    expect(result.endDate).toBeInstanceOf(Date);
    expect(result.label).toBe('Last Month');
  });
});
