import { prisma } from '../../db/prisma.js';
import Decimal from 'decimal.js';

export class ARAgingService {
  /**
   * Calculate AR aging for all customers
   * Updates aging buckets based on unpaid sales
   */
  static async calculateAgingForAll() {
    const customers = await prisma.customer.findMany({
      where: { is_b2b: true },
      include: { sales: true },
    });

    const results = [];

    for (const customer of customers) {
      const aging = await this.calculateAgingForCustomer(customer.id);
      results.push(aging);
    }

    return results;
  }

  /**
   * Calculate AR aging for a specific customer
   */
  static async calculateAgingForCustomer(customerId: string) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { sales: true },
    });

    if (!customer) throw new Error('Customer not found.');

    const now = new Date();
    const agingBuckets = {
      aging_0_30: new Decimal(0),
      aging_31_60: new Decimal(0),
      aging_61_90: new Decimal(0),
      aging_90_plus: new Decimal(0),
    };

    let totalOutstanding = new Decimal(0);

    // Calculate aging based on unpaid sales (assuming credit sales)
    for (const sale of customer.sales) {
      if (sale.status === 'COMPLETED') {
        const saleDate = new Date(sale.created_at);
        const daysSinceSale = Math.floor((now.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24));
        const saleAmount = new Decimal(sale.total_amount);

        // Only count unpaid sales (simplified - in real system would track payments)
        // For now, assume all sales are unpaid for AR calculation
        totalOutstanding = totalOutstanding.plus(saleAmount);

        if (daysSinceSale <= 30) {
          agingBuckets.aging_0_30 = agingBuckets.aging_0_30.plus(saleAmount);
        } else if (daysSinceSale <= 60) {
          agingBuckets.aging_31_60 = agingBuckets.aging_31_60.plus(saleAmount);
        } else if (daysSinceSale <= 90) {
          agingBuckets.aging_61_90 = agingBuckets.aging_61_90.plus(saleAmount);
        } else {
          agingBuckets.aging_90_plus = agingBuckets.aging_90_plus.plus(saleAmount);
        }
      }
    }

    // Determine collection status
    let collectionStatus = 'ACTIVE';
    if (agingBuckets.aging_90_plus.greaterThan(0)) {
      collectionStatus = 'LEGAL';
    } else if (agingBuckets.aging_61_90.greaterThan(0)) {
      collectionStatus = 'COLLECTION';
    } else if (agingBuckets.aging_31_60.greaterThan(0)) {
      collectionStatus = 'OVERDUE';
    }

    // Check if credit hold should be applied
    const creditLimit = new Decimal(customer.credit_limit);
    const creditHold = totalOutstanding.greaterThan(creditLimit);

    // Update customer with aging data
    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: {
        outstanding_balance: totalOutstanding.toNumber(),
        aging_0_30: agingBuckets.aging_0_30.toNumber(),
        aging_31_60: agingBuckets.aging_31_60.toNumber(),
        aging_61_90: agingBuckets.aging_61_90.toNumber(),
        aging_90_plus: agingBuckets.aging_90_plus.toNumber(),
        collection_status: collectionStatus,
        credit_hold: creditHold,
      },
    });

    return updated;
  }

  /**
   * Place credit hold on a customer
   */
  static async placeCreditHold(customerId: string, userId: string, reason: string) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new Error('Customer not found.');

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: { credit_hold: true },
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'CREDIT_HOLD_PLACED',
        entity: 'Customer',
        entity_id: customerId,
        old_values: JSON.stringify({ credit_hold: false }),
        new_values: JSON.stringify({ credit_hold: true, reason }),
      },
    });

    return updated;
  }

  /**
   * Release credit hold on a customer
   */
  static async releaseCreditHold(customerId: string, userId: string, reason: string) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new Error('Customer not found.');

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: { credit_hold: false },
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'CREDIT_HOLD_RELEASED',
        entity: 'Customer',
        entity_id: customerId,
        old_values: JSON.stringify({ credit_hold: true }),
        new_values: JSON.stringify({ credit_hold: false, reason }),
      },
    });

    return updated;
  }

  /**
   * Get customers with overdue balances
   */
  static async getOverdueCustomers() {
    return prisma.customer.findMany({
      where: {
        is_b2b: true,
        OR: [
          { aging_31_60: { gt: 0 } },
          { aging_61_90: { gt: 0 } },
          { aging_90_plus: { gt: 0 } },
        ],
      },
      orderBy: { outstanding_balance: 'desc' },
    });
  }

  /**
   * Get customers on credit hold
   */
  static async getCreditHoldCustomers() {
    return prisma.customer.findMany({
      where: {
        credit_hold: true,
        is_b2b: true,
      },
      orderBy: { outstanding_balance: 'desc' },
    });
  }

  /**
   * Get AR aging summary report
   */
  static async getAgingSummary() {
    const customers = await prisma.customer.findMany({
      where: { is_b2b: true },
    });

    const summary = {
      totalOutstanding: new Decimal(0),
      aging_0_30: new Decimal(0),
      aging_31_60: new Decimal(0),
      aging_61_90: new Decimal(0),
      aging_90_plus: new Decimal(0),
      creditHoldCount: 0,
      overdueCount: 0,
      customerCount: customers.length,
    };

    for (const customer of customers) {
      summary.totalOutstanding = summary.totalOutstanding.plus(new Decimal(customer.outstanding_balance));
      summary.aging_0_30 = summary.aging_0_30.plus(new Decimal(customer.aging_0_30));
      summary.aging_31_60 = summary.aging_31_60.plus(new Decimal(customer.aging_31_60));
      summary.aging_61_90 = summary.aging_61_90.plus(new Decimal(customer.aging_61_90));
      summary.aging_90_plus = summary.aging_90_plus.plus(new Decimal(customer.aging_90_plus));

      if (customer.credit_hold) summary.creditHoldCount++;
      if (customer.collection_status !== 'ACTIVE') summary.overdueCount++;
    }

    return {
      totalOutstanding: summary.totalOutstanding.toNumber(),
      aging_0_30: summary.aging_0_30.toNumber(),
      aging_31_60: summary.aging_31_60.toNumber(),
      aging_61_90: summary.aging_61_90.toNumber(),
      aging_90_plus: summary.aging_90_plus.toNumber(),
      creditHoldCount: summary.creditHoldCount,
      overdueCount: summary.overdueCount,
      customerCount: summary.customerCount,
    };
  }
}
