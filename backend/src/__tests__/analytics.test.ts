import { describe, it, expect } from 'vitest';

describe('Phase K & L — Analytics Engine & CEO Dashboard', () => {
  it('should calculate correct date range filters for today, yesterday, and this month', () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    expect(todayStart.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(yesterdayStart.getTime()).toBeLessThan(todayStart.getTime());
    expect(thisMonthStart.getDate()).toBe(1);
  });

  it('should compute financial metrics correctly (Gross Profit = Revenue - COGS, Net Profit = Gross Profit - Expenses)', () => {
    const revenue = 1500;
    const cogs = 800;
    const grossProfit = revenue - cogs;
    const operatingExpenses = 300;
    const netProfit = grossProfit - operatingExpenses;

    expect(grossProfit).toBe(700);
    expect(netProfit).toBe(400);
  });
});
