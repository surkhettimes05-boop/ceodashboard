import { prisma } from '../../db/prisma.js';
import { SalesChannel, PaymentMethod } from '@prisma/client';
import Decimal from 'decimal.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { AccountingService } from '../accounting/accounting.service.js';
import { FeedbackService } from '../feedback/feedback.service.js';
import { ComplaintsService } from '../complaints/complaints.service.js';

export interface DashboardFilter {
  startDate?: Date;
  endDate?: Date;
  branchId?: string;
}

export class AnalyticsService {
  static resolveDateRange(range: string, referenceDate: Date = new Date()) {
    const now = new Date(referenceDate);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const map: Record<string, { startDate: Date; endDate: Date; label: string }> = {
      today: { startDate: startOfToday, endDate: endOfToday, label: 'Today' },
      yesterday: {
        startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
        endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999),
        label: 'Yesterday',
      },
      this_week: {
        startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()),
        endDate: endOfToday,
        label: 'This Week',
      },
      last_week: {
        startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - 7),
        endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - 1, 23, 59, 59, 999),
        label: 'Last Week',
      },
      this_month: {
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: endOfToday,
        label: 'This Month',
      },
      last_month: {
        startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        endDate: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
        label: 'Last Month',
      },
      this_quarter: {
        startDate: new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1),
        endDate: endOfToday,
        label: 'This Quarter',
      },
      this_year: {
        startDate: new Date(now.getFullYear(), 0, 1),
        endDate: endOfToday,
        label: 'This Year',
      },
      all_time: {
        startDate: new Date(2000, 0, 1),
        endDate: endOfToday,
        label: 'All Time',
      },
    };

    const bucket = map[String(range || 'this_month').toLowerCase()];
    if (bucket) {
      return bucket;
    }

    return {
      startDate: startOfToday,
      endDate: endOfToday,
      label: 'Today',
    };
  }

  static async getExecutiveDashboard(filter: DashboardFilter) {
    const { startDate, endDate, branchId } = filter;

    const salesWhere: any = {};
    if (startDate || endDate) {
      salesWhere.created_at = {};
      if (startDate) salesWhere.created_at.gte = startDate;
      if (endDate) salesWhere.created_at.lte = endDate;
    }
    if (branchId) {
      salesWhere.branch_id = branchId;
    }

    // 1. Fetch Sales Data
    const sales = await prisma.sale.findMany({
      where: salesWhere,
      include: {
        sale_items: true,
        sale_payments: true,
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    let totalSalesVolume = new Decimal(0);
    let totalCogsVolume = new Decimal(0);
    let cashSalesVolume = new Decimal(0);
    let digitalPaymentsVolume = new Decimal(0);

    let retailVolume = new Decimal(0);
    let b2bVolume = new Decimal(0);
    let onlineVolume = new Decimal(0);

    const branchMap: Record<string, { branchName: string; sales: Decimal; transactions: number }> = {};

    for (const s of sales) {
      const saleAmt = new Decimal(s.total_amount);
      totalSalesVolume = totalSalesVolume.plus(saleAmt);

      // Channel Breakdown
      if (s.channel === SalesChannel.RETAIL) retailVolume = retailVolume.plus(saleAmt);
      else if (s.channel === SalesChannel.B2B) b2bVolume = b2bVolume.plus(saleAmt);
      else if (s.channel === SalesChannel.ONLINE) onlineVolume = onlineVolume.plus(saleAmt);

      // Branch Breakdown
      const bName = s.branch?.name || 'Main Branch';
      if (!branchMap[bName]) {
        branchMap[bName] = { branchName: bName, sales: new Decimal(0), transactions: 0 };
      }
      branchMap[bName].sales = branchMap[bName].sales.plus(saleAmt);
      branchMap[bName].transactions += 1;

      // COGS Calculation from Sale Items
      for (const item of s.sale_items) {
        totalCogsVolume = totalCogsVolume.plus(new Decimal(item.quantity).times(new Decimal(item.unit_cost)));
      }

      // Payments Breakdown
      for (const pay of s.sale_payments) {
        const amt = new Decimal(pay.amount);
        if (pay.payment_method === PaymentMethod.CASH) {
          cashSalesVolume = cashSalesVolume.plus(amt);
        } else if (pay.payment_method === PaymentMethod.CARD || pay.payment_method === PaymentMethod.MOBILE_MONEY || pay.payment_method === PaymentMethod.BANK_TRANSFER) {
          digitalPaymentsVolume = digitalPaymentsVolume.plus(amt);
        }
      }
    }

    const transactionCount = sales.length;
    const avgTransactionValue = transactionCount > 0 ? totalSalesVolume.dividedBy(transactionCount) : new Decimal(0);
    const grossProfit = totalSalesVolume.minus(totalCogsVolume);

    // 2. Fetch Operating Expenses
    const expensesWhere: any = {};
    if (startDate || endDate) {
      expensesWhere.created_at = {};
      if (startDate) expensesWhere.created_at.gte = startDate;
      if (endDate) expensesWhere.created_at.lte = endDate;
    }
    if (branchId) expensesWhere.branch_id = branchId;

    const expenses = await prisma.expense.findMany({ where: expensesWhere });
    let totalExpenses = new Decimal(0);
    for (const exp of expenses) {
      totalExpenses = totalExpenses.plus(new Decimal(exp.amount));
    }

    const netProfit = grossProfit.minus(totalExpenses);
    const finalFinancialMetrics = AccountingService.calculateFinancialMetrics({
      revenue: totalSalesVolume.toNumber(),
      cogs: totalCogsVolume.toNumber(),
      operatingExpenses: totalExpenses.toNumber(),
    });

    // 3. Inventory Valuation & Alert Metrics
    const balances = await prisma.stockBalance.findMany({
      include: { product: true },
    });

    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const b of balances) {
      const qty = new Decimal(b.quantity);
      const cost = new Decimal(b.product.cost_price);
      if (qty.isZero() || qty.isNegative()) {
        outOfStockCount++;
      } else if (qty.lessThanOrEqualTo(b.product.min_stock_level)) {
        lowStockCount++;
      }
    }

    const realInventoryValue = InventoryService.calculateInventoryValue(
      balances.map((b) => ({ quantity: b.quantity, unitCost: b.product.cost_price }))
    );

    // 4. B2B Receivables & Customer Metrics
    const b2bCustomers = await prisma.customer.findMany({ where: { is_b2b: true } });
    let outstandingB2bReceivables = new Decimal(0);
    for (const c of b2bCustomers) {
      outstandingB2bReceivables = outstandingB2bReceivables.plus(new Decimal(c.outstanding_balance));
    }

    const totalCustomersCount = await prisma.customer.count();
    const ledgerBalances = await AccountingService.getAccountBalancesSnapshot();
    const customerLoyalty = await this.getCustomerLoyaltyMetrics(
      startDate && endDate ? 'custom' : 'this_month',
      startDate,
      endDate
    );

    return {
      financials: {
        sales: finalFinancialMetrics.revenue,
        cogs: finalFinancialMetrics.cogs,
        grossProfit: finalFinancialMetrics.grossProfit,
        operatingExpenses: finalFinancialMetrics.operatingExpenses,
        netProfit: finalFinancialMetrics.operatingProfit,
        cashAndBank: ledgerBalances.cashAndBank,
        accountsReceivable: ledgerBalances.accountsReceivable,
        accountsPayable: ledgerBalances.accountsPayable,
        inventoryAssetValue: ledgerBalances.inventoryAssetValue,
        cashSales: cashSalesVolume.toNumber(),
        digitalPayments: digitalPaymentsVolume.toNumber(),
        transactionCount,
        avgTransactionValue: avgTransactionValue.toNumber(),
      },
      inventory: {
        totalValue: realInventoryValue,
        lowStockCount,
        outOfStockCount,
        totalTrackedProducts: balances.length,
      },
      channels: {
        retail: retailVolume.toNumber(),
        b2b: b2bVolume.toNumber(),
        online: onlineVolume.toNumber(),
      },
      branches: Object.values(branchMap).map((b) => ({
        branchName: b.branchName,
        sales: b.sales.toNumber(),
        transactions: b.transactions,
      })),
      customers: {
        totalCustomers: totalCustomersCount,
        outstandingB2bReceivables: outstandingB2bReceivables.toNumber(),
      },
      customerLoyalty,
    };
  }

  /**
   * Get customer experience metrics for store manager dashboard
   */
  static async getCustomerExperienceMetrics(storeId: string, dateRange: string = 'this_month') {
    const { startDate, endDate } = this.resolveDateRange(dateRange);

    // Get feedback summary
    const feedbackSummary = await FeedbackService.getStoreFeedbackSummary(storeId, startDate, endDate);

    // Get complaint stats
    const complaintStats = await ComplaintsService.getComplaintStats(storeId, startDate, endDate);

    // Get loyalty member count and points issued
    const loyaltyCustomers = await (prisma as any).customer.findMany({
      where: {
        loyalty_points_balance: { gt: 0 },
      },
      select: {
        id: true,
        loyalty_points_balance: true,
        lifetime_spend: true,
      },
    });

    const totalLoyaltyMembers = loyaltyCustomers.length;
    const totalPointsIssued = loyaltyCustomers.reduce((sum: number, c: any) => sum + c.loyalty_points_balance.toNumber(), 0);
    const totalLifetimeSpend = loyaltyCustomers.reduce((sum: number, c: any) => sum + c.lifetime_spend.toNumber(), 0);

    return {
      feedback: feedbackSummary,
      complaints: complaintStats,
      loyalty: {
        totalMembers: totalLoyaltyMembers,
        totalPointsIssued,
        totalLifetimeSpend,
        avgPointsPerMember: totalLoyaltyMembers > 0 ? Math.round(totalPointsIssued / totalLoyaltyMembers) : 0,
      },
      dateRange: {
        startDate,
        endDate,
        label: this.resolveDateRange(dateRange).label,
      },
    };
  }

  /**
   * Get customer and loyalty metrics for CEO Tower
   */
  static async getCustomerLoyaltyMetrics(dateRange: string = 'this_month', suppliedStartDate?: Date, suppliedEndDate?: Date) {
    const resolved = suppliedStartDate && suppliedEndDate
      ? { startDate: suppliedStartDate, endDate: suppliedEndDate, label: 'Selected period' }
      : this.resolveDateRange(dateRange);
    const { startDate, endDate } = resolved;

    // Total customers
    const totalCustomers = await prisma.customer.count();

    // New customers in period
    const newCustomers = await prisma.customer.count({
      where: {
        created_at: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Active customers (with purchases in period)
    const activeCustomers = await (prisma as any).customer.count({
      where: {
        last_purchase_at: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Loyalty metrics
    const loyaltyData = await (prisma as any).customer.findMany({
      select: {
        loyalty_points_balance: true,
        lifetime_spend: true,
        total_orders: true,
      },
    });

    const loyaltyTransactions = await (prisma as any).loyaltyTransaction.findMany({
      where: { created_at: { gte: startDate, lte: endDate } },
      select: { type: true, points: true },
    });
    const totalPointsIssued = loyaltyTransactions
      .filter((transaction: any) => transaction.type === 'EARN')
      .reduce((sum: number, transaction: any) => sum + Math.max(0, transaction.points.toNumber()), 0);
    const totalPointsRedeemed = Math.abs(loyaltyTransactions
      .filter((transaction: any) => transaction.type === 'REDEEM')
      .reduce((sum: number, transaction: any) => sum + transaction.points.toNumber(), 0));
    const outstandingPoints = loyaltyData.reduce((sum: number, c: any) => sum + c.loyalty_points_balance.toNumber(), 0);
    const totalLifetimeSpend = loyaltyData.reduce((sum: number, c: any) => sum + c.lifetime_spend.toNumber(), 0);
    const totalOrders = loyaltyData.reduce((sum: number, c: any) => sum + c.total_orders, 0);

    const loyaltyMembers = loyaltyData.filter((c: any) => c.loyalty_points_balance.toNumber() > 0).length;
    const repeatCustomers = loyaltyData.filter((c: any) => c.total_orders > 1).length;

    return {
      customers: {
        total: totalCustomers,
        new: newCustomers,
        active: activeCustomers,
        loyaltyMembers,
        repeatCustomers,
        repeatPurchaseRate: totalCustomers > 0 ? repeatCustomers / totalCustomers : 0,
      },
      loyalty: {
        totalPointsIssued,
        totalPointsRedeemed,
        outstandingPoints,
        totalLifetimeSpend,
        totalOrders,
        avgPointsPerMember: loyaltyMembers > 0 ? Math.round(totalPointsIssued / loyaltyMembers) : 0,
        avgSpendPerCustomer: totalCustomers > 0 ? Math.round(totalLifetimeSpend / totalCustomers) : 0,
        avgBasket: totalOrders > 0 ? Math.round(totalLifetimeSpend / totalOrders) : 0,
        avgOrdersPerCustomer: totalCustomers > 0 ? Math.round(totalOrders / totalCustomers) : 0,
      },
      dateRange: {
        startDate,
        endDate,
        label: resolved.label,
      },
    };
  }
}
