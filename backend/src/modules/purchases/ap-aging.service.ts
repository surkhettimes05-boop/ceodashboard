import { prisma } from '../../db/prisma.js';
import Decimal from 'decimal.js';

export class APAgingService {
  /**
   * Calculate AP aging for all suppliers
   * Updates aging buckets based on unpaid purchases
   */
  static async calculateAgingForAll() {
    const suppliers = await prisma.supplier.findMany({
      include: { purchases: true },
    });

    const results = [];

    for (const supplier of suppliers) {
      const aging = await this.calculateAgingForSupplier(supplier.id);
      results.push(aging);
    }

    return results;
  }

  /**
   * Calculate AP aging for a specific supplier
   */
  static async calculateAgingForSupplier(supplierId: string) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      include: { purchases: true },
    });

    if (!supplier) throw new Error('Supplier not found.');

    const now = new Date();
    const agingBuckets = {
      aging_0_30: new Decimal(0),
      aging_31_60: new Decimal(0),
      aging_61_90: new Decimal(0),
      aging_90_plus: new Decimal(0),
    };

    let totalOutstanding = new Decimal(0);
    const paymentTermsDays = supplier.payment_terms_days || 30;

    // Calculate aging based on unpaid purchases
    for (const purchase of supplier.purchases) {
      if (purchase.status === 'RECEIVED') {
        const purchaseDate = new Date(purchase.created_at);
        const dueDate = new Date(purchaseDate);
        dueDate.setDate(dueDate.getDate() + paymentTermsDays);
        
        const daysSinceDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const purchaseAmount = new Decimal(purchase.total_amount);

        // Assume all received purchases are unpaid for AP calculation
        // In real system would track supplier payments
        totalOutstanding = totalOutstanding.plus(purchaseAmount);

        if (daysSinceDue <= 0) {
          agingBuckets.aging_0_30 = agingBuckets.aging_0_30.plus(purchaseAmount);
        } else if (daysSinceDue <= 30) {
          agingBuckets.aging_0_30 = agingBuckets.aging_0_30.plus(purchaseAmount);
        } else if (daysSinceDue <= 60) {
          agingBuckets.aging_31_60 = agingBuckets.aging_31_60.plus(purchaseAmount);
        } else if (daysSinceDue <= 90) {
          agingBuckets.aging_61_90 = agingBuckets.aging_61_90.plus(purchaseAmount);
        } else {
          agingBuckets.aging_90_plus = agingBuckets.aging_90_plus.plus(purchaseAmount);
        }
      }
    }

    // Update supplier with aging data
    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        outstanding_balance: totalOutstanding.toNumber(),
        aging_0_30: agingBuckets.aging_0_30.toNumber(),
        aging_31_60: agingBuckets.aging_31_60.toNumber(),
        aging_61_90: agingBuckets.aging_61_90.toNumber(),
        aging_90_plus: agingBuckets.aging_90_plus.toNumber(),
      },
    });

    return updated;
  }

  /**
   * Get suppliers with overdue payments
   */
  static async getOverdueSuppliers() {
    return prisma.supplier.findMany({
      where: {
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
   * Get upcoming payment schedule (payments due in next 30 days)
   */
  static async getUpcomingPayments() {
    const suppliers = await prisma.supplier.findMany({
      where: {
        aging_0_30: { gt: 0 },
      },
      orderBy: { outstanding_balance: 'desc' },
    });

    return suppliers.map(supplier => ({
      supplierId: supplier.id,
      supplierName: supplier.name,
      amountDue: supplier.aging_0_30,
      paymentTermsDays: supplier.payment_terms_days,
      contactPerson: supplier.contact_person,
      phone: supplier.phone,
    }));
  }

  /**
   * Get AP aging summary report
   */
  static async getAgingSummary() {
    const suppliers = await prisma.supplier.findMany();

    const summary = {
      totalOutstanding: new Decimal(0),
      aging_0_30: new Decimal(0),
      aging_31_60: new Decimal(0),
      aging_61_90: new Decimal(0),
      aging_90_plus: new Decimal(0),
      overdueCount: 0,
      supplierCount: suppliers.length,
    };

    for (const supplier of suppliers) {
      summary.totalOutstanding = summary.totalOutstanding.plus(new Decimal(supplier.outstanding_balance));
      summary.aging_0_30 = summary.aging_0_30.plus(new Decimal(supplier.aging_0_30));
      summary.aging_31_60 = summary.aging_31_60.plus(new Decimal(supplier.aging_31_60));
      summary.aging_61_90 = summary.aging_61_90.plus(new Decimal(supplier.aging_61_90));
      summary.aging_90_plus = summary.aging_90_plus.plus(new Decimal(supplier.aging_90_plus));

      if (new Decimal(supplier.aging_31_60).greaterThan(0) || new Decimal(supplier.aging_61_90).greaterThan(0) || new Decimal(supplier.aging_90_plus).greaterThan(0)) {
        summary.overdueCount++;
      }
    }

    return {
      totalOutstanding: summary.totalOutstanding.toNumber(),
      aging_0_30: summary.aging_0_30.toNumber(),
      aging_31_60: summary.aging_31_60.toNumber(),
      aging_61_90: summary.aging_61_90.toNumber(),
      aging_90_plus: summary.aging_90_plus.toNumber(),
      overdueCount: summary.overdueCount,
      supplierCount: summary.supplierCount,
    };
  }

  /**
   * Update supplier payment terms
   */
  static async updatePaymentTerms(supplierId: string, paymentTermsDays: number, userId: string) {
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new Error('Supplier not found.');

    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: { payment_terms_days: paymentTermsDays },
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: 'PAYMENT_TERMS_UPDATED',
        entity: 'Supplier',
        entity_id: supplierId,
        old_values: JSON.stringify({ payment_terms_days: supplier.payment_terms_days }),
        new_values: JSON.stringify({ payment_terms_days: paymentTermsDays }),
      },
    });

    return updated;
  }
}
