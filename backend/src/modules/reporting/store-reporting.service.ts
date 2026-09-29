import { prisma } from '../../db/prisma.js';

export class StoreReportingService {
  static async getDailySummary(startDate: Date, endDate: Date, branchId?: string) {
    const sales = await prisma.sale.findMany({
      where: {
        created_at: { gte: startDate, lte: endDate },
        ...(branchId ? { branch_id: branchId } : {}),
        status: 'COMPLETED',
      },
      select: {
        total_amount: true,
        branch: { select: { id: true, name: true } },
      },
    });

    const byStore = new Map<string, { branchId: string | null; storeName: string; sales: number; orders: number }>();
    for (const sale of sales) {
      const storeName = sale.branch?.name ?? 'Unassigned store';
      const key = sale.branch?.id ?? 'unassigned';
      const current = byStore.get(key) ?? { branchId: sale.branch?.id ?? null, storeName, sales: 0, orders: 0 };
      current.sales += Number(sale.total_amount);
      current.orders += 1;
      byStore.set(key, current);
    }

    const [cancelledOrders, balances] = await Promise.all([
      prisma.sale.count({
        where: {
          created_at: { gte: startDate, lte: endDate },
          ...(branchId ? { branch_id: branchId } : {}),
          status: { in: ['CANCELLED', 'VOIDED'] },
        },
      }),
      prisma.stockBalance.findMany({
        where: { location_type: 'BRANCH', ...(branchId ? { location_id: branchId } : {}) },
        select: { quantity: true, product: { select: { min_stock_level: true } } },
      }),
    ]);

    const totalUnits = balances.reduce((sum, balance) => sum + Number(balance.quantity), 0);
    const lowStockProducts = balances.filter(
      (balance) => Number(balance.quantity) <= Number(balance.product.min_stock_level)
    ).length;

    return {
      sales: sales.reduce((sum, sale) => sum + Number(sale.total_amount), 0),
      orderCount: sales.length,
      cancelledOrders,
      byStore: [...byStore.values()],
      inventory: { totalUnits, productCount: balances.length, lowStockProducts },
    };
  }
}
