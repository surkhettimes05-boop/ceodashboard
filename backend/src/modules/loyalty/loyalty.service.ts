import { prisma } from '../../db/prisma.js';
import Decimal from 'decimal.js';
import { AuditService } from '../audit/audit.service.js';

export interface LoyaltySettings {
  pointsPerCurrency: number;
  currencyPerPoint: number;
  minimumRedeemPoints: number;
  pointsValue: number;
  active: boolean;
}

export class LoyaltyService {
  private static client(database: any = prisma) {
    return database;
  }
  /**
   * Get current loyalty settings
   */
  static async getSettings(database: any = prisma): Promise<LoyaltySettings> {
    const settings = await (database as any).loyaltySettings.findFirst({
      where: { active: true },
    });

    if (!settings) {
      // Return default settings
      return {
        pointsPerCurrency: 1,
        currencyPerPoint: 100,
        minimumRedeemPoints: 100,
        pointsValue: 1,
        active: true,
      };
    }

    return {
      pointsPerCurrency: settings.points_per_currency.toNumber(),
      currencyPerPoint: settings.currency_per_point.toNumber(),
      minimumRedeemPoints: settings.minimum_redeem_points,
      pointsValue: settings.points_value.toNumber(),
      active: settings.active,
    };
  }

  static async updateSettings(input: Partial<LoyaltySettings>): Promise<LoyaltySettings> {
    const current = await (prisma as any).loyaltySettings.findFirst({ orderBy: { updated_at: 'desc' } });
    const data = {
      points_per_currency: input.pointsPerCurrency,
      currency_per_point: input.currencyPerPoint,
      minimum_redeem_points: input.minimumRedeemPoints,
      points_value: input.pointsValue,
      active: input.active,
    };
    const settings = current
      ? await (prisma as any).loyaltySettings.update({ where: { id: current.id }, data })
      : await (prisma as any).loyaltySettings.create({ data: { ...data, points_per_currency: input.pointsPerCurrency ?? 1, currency_per_point: input.currencyPerPoint ?? 100, minimum_redeem_points: input.minimumRedeemPoints ?? 100, points_value: input.pointsValue ?? 1, active: input.active ?? true } });
    return {
      pointsPerCurrency: settings.points_per_currency.toNumber(),
      currencyPerPoint: settings.currency_per_point.toNumber(),
      minimumRedeemPoints: settings.minimum_redeem_points,
      pointsValue: settings.points_value.toNumber(),
      active: settings.active,
    };
  }

  /**
   * Calculate points from sale amount
   */
  static async calculatePoints(saleAmount: number, database: any = prisma): Promise<number> {
    const settings = await this.getSettings(database);
    const amount = new Decimal(saleAmount);
    const pointsPerCurrency = new Decimal(settings.pointsPerCurrency);
    const currencyPerPoint = new Decimal(settings.currencyPerPoint);
    
    // Points = (saleAmount / currencyPerPoint) * pointsPerCurrency
    const points = amount.dividedBy(currencyPerPoint).times(pointsPerCurrency);
    return Math.floor(points.toNumber());
  }

  static async previewPoints(saleAmount: number) {
    const settings = await this.getSettings();
    const points = await this.calculatePoints(saleAmount, prisma);
    return { points, settings };
  }

  /**
   * Award points to customer
   */
  static async awardPoints(
    customerId: string,
    saleId: string,
    points: number,
    description: string,
    actorUserId?: string,
    database: any = prisma
  ): Promise<void> {
    const operation = async (tx: any) => {
      const existing = await tx.loyaltyTransaction.findFirst({
        where: { sale_id: saleId, type: 'EARN' },
        select: { id: true },
      });

      if (existing) return;

      // Get current balance
      // @ts-ignore - loyalty_points_balance will exist after migration
      const customer = await (tx as any).customer.findUnique({
        where: { id: customerId },
        select: { loyalty_points_balance: true },
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      const currentBalance = new Decimal(customer.loyalty_points_balance);
      const pointsToAdd = new Decimal(points);
      const newBalance = currentBalance.plus(pointsToAdd);

      // Create loyalty transaction
      await (tx as any).loyaltyTransaction.create({
        data: {
          customer_id: customerId,
          sale_id: saleId,
          type: 'EARN',
          points: pointsToAdd.toNumber(),
          balance_after: newBalance.toNumber(),
          description,
          created_by: actorUserId,
        },
      });

      // Update customer balance
      // @ts-ignore - loyalty_points_balance will exist after migration
      await (tx as any).customer.update({
        where: { id: customerId },
        data: {
          loyalty_points_balance: newBalance.toNumber(),
        },
      });
    };

    return database === prisma ? prisma.$transaction(operation) : operation(database);
  }

  /**
   * Redeem points from customer
   */
  static async redeemPoints(
    customerId: string,
    points: number,
    description: string,
    actorUserId?: string
  ): Promise<void> {
    return prisma.$transaction(async (tx) => {
      await this.redeemPointsInTransaction(tx, customerId, points, description, actorUserId);
    });
  }

  static async redeemPointsInTransaction(
    tx: any,
    customerId: string,
    points: number,
    description: string,
    actorUserId?: string,
    saleId?: string
  ): Promise<void> {
      // Get current balance
      // @ts-ignore - loyalty_points_balance will exist after migration
      const customer = await (tx as any).customer.findUnique({
        where: { id: customerId },
        select: { loyalty_points_balance: true },
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      const currentBalance = new Decimal(customer.loyalty_points_balance);
      const pointsToRedeem = new Decimal(points);

      const settings = await (tx as any).loyaltySettings.findFirst({ where: { active: true } });
      const minimumRedeemPoints = settings?.minimum_redeem_points ?? 100;
      if (pointsToRedeem.lessThan(minimumRedeemPoints)) {
        throw new Error(`Minimum redemption is ${minimumRedeemPoints} points`);
      }

      // Check sufficient balance
      if (currentBalance.lessThan(pointsToRedeem)) {
        throw new Error('Insufficient points balance');
      }

      const newBalance = currentBalance.minus(pointsToRedeem);

      // Create loyalty transaction
      await (tx as any).loyaltyTransaction.create({
        data: {
          customer_id: customerId,
          sale_id: saleId || null,
          type: 'REDEEM',
          points: pointsToRedeem.negated().toNumber(),
          balance_after: newBalance.toNumber(),
          description,
          created_by: actorUserId,
        },
      });

      // Update customer balance
      // @ts-ignore - loyalty_points_balance will exist after migration
      await (tx as any).customer.update({
        where: { id: customerId },
        data: {
          loyalty_points_balance: newBalance.toNumber(),
        },
      });

      // Audit log
      await AuditService.log({
        userId: actorUserId,
        action: 'LOYALTY_POINTS_REDEEMED',
        entity: 'LoyaltyTransaction',
        entityId: customerId,
        oldValues: { balance: currentBalance.toNumber() },
        newValues: { balance: newBalance.toNumber(), pointsRedeemed: points },
      }, tx);
  }

  /**
   * Manual point adjustment (admin only)
   */
  static async adjustPoints(
    customerId: string,
    points: number,
    reason: string,
    actorUserId?: string
  ): Promise<void> {
    return prisma.$transaction(async (tx) => {
      // Get current balance
      // @ts-ignore - loyalty_points_balance will exist after migration
      const customer = await (tx as any).customer.findUnique({
        where: { id: customerId },
        select: { loyalty_points_balance: true },
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      const currentBalance = new Decimal(customer.loyalty_points_balance);
      const pointsToAdjust = new Decimal(points);
      const newBalance = currentBalance.plus(pointsToAdjust);

      // Prevent negative balance
      if (newBalance.lessThan(0)) {
        throw new Error('Adjustment would result in negative balance');
      }

      const type = 'ADJUSTMENT';

      // Create loyalty transaction
      await (tx as any).loyaltyTransaction.create({
        data: {
          customer_id: customerId,
          type,
          points: pointsToAdjust.toNumber(),
          balance_after: newBalance.toNumber(),
          description: `Manual adjustment: ${reason}`,
          created_by: actorUserId,
        },
      });

      // Update customer balance
      // @ts-ignore - loyalty_points_balance will exist after migration
      await (tx as any).customer.update({
        where: { id: customerId },
        data: {
          loyalty_points_balance: newBalance.toNumber(),
        },
      });

      // Audit log
      await AuditService.log({
        userId: actorUserId,
        action: 'LOYALTY_POINTS_ADJUSTED',
        entity: 'LoyaltyTransaction',
        entityId: customerId,
        oldValues: { balance: currentBalance.toNumber() },
        newValues: { balance: newBalance.toNumber(), adjustment: points, reason },
      });
    });
  }

  /**
   * Reverse points on refund
   */
  static async reversePoints(saleId: string, actorUserId?: string): Promise<void> {
    return prisma.$transaction(async (tx) => {
      // Find loyalty transaction for this sale
      const loyaltyTx = await (tx as any).loyaltyTransaction.findFirst({
        where: {
          sale_id: saleId,
          type: 'EARN',
        },
        orderBy: { created_at: 'desc' },
      });

      if (!loyaltyTx) {
        // No points to reverse
        return;
      }

      const customer = await (tx as any).customer.findUnique({
        where: { id: loyaltyTx.customer_id },
        select: { loyalty_points_balance: true },
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      const currentBalance = new Decimal(customer.loyalty_points_balance);
      const pointsToReverse = new Decimal(loyaltyTx.points);
      const newBalance = currentBalance.minus(pointsToReverse);

      // Prevent negative balance
      if (newBalance.lessThan(0)) {
        throw new Error('Cannot reverse points: would result in negative balance');
      }

      // Create reversal transaction
      await (tx as any).loyaltyTransaction.create({
        data: {
          customer_id: loyaltyTx.customer_id,
          sale_id: saleId,
          type: 'REFUND_REVERSAL',
          points: pointsToReverse.negated().toNumber(),
          balance_after: newBalance.toNumber(),
          description: `Points reversed for sale refund: ${saleId}`,
          created_by: actorUserId,
        },
      });

      // Update customer balance
      // @ts-ignore - loyalty_points_balance will exist after migration
      await (tx as any).customer.update({
        where: { id: loyaltyTx.customer_id },
        data: {
          loyalty_points_balance: newBalance.toNumber(),
        },
      });

      // Audit log
      await AuditService.log({
        userId: actorUserId,
        action: 'LOYALTY_POINTS_REVERSED',
        entity: 'LoyaltyTransaction',
        entityId: loyaltyTx.customer_id,
        oldValues: { balance: currentBalance.toNumber() },
        newValues: { balance: newBalance.toNumber(), reversedPoints: pointsToReverse.toNumber() },
      });
    });
  }

  /**
   * Get loyalty ledger for customer
   */
  static async getLoyaltyLedger(customerId: string) {
    const transactions = await (prisma as any).loyaltyTransaction.findMany({
      where: { customer_id: customerId },
      include: {
        sale: {
          select: {
            sale_number: true,
            created_at: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return transactions;
  }

  /**
   * Get current loyalty balance
   */
  static async getLoyaltyBalance(customerId: string, database: any = prisma): Promise<number> {
    // @ts-ignore - loyalty_points_balance will exist after migration
    const customer = await this.client(database).customer.findUnique({
      where: { id: customerId },
      select: { loyalty_points_balance: true },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    return customer.loyalty_points_balance.toNumber();
  }

  /**
   * Update customer loyalty stats after sale
   */
  static async updateCustomerStats(
    customerId: string,
    saleAmount: number,
    actorUserId?: string,
    database: any = prisma
  ): Promise<void> {
    // @ts-ignore - loyalty fields will exist after migration
    const customer = await this.client(database).customer.findUnique({
      where: { id: customerId },
      select: {
        lifetime_spend: true,
        total_orders: true,
        first_purchase_at: true,
      },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    const lifetimeSpend = new Decimal(customer.lifetime_spend);
    const newLifetimeSpend = lifetimeSpend.plus(saleAmount);
    const newTotalOrders = customer.total_orders + 1;

    // @ts-ignore - loyalty fields will exist after migration
    await this.client(database).customer.update({
      where: { id: customerId },
      data: {
        lifetime_spend: newLifetimeSpend.toNumber(),
        total_orders: newTotalOrders,
        last_purchase_at: new Date(),
        first_purchase_at: customer.first_purchase_at || new Date(),
      },
    });
  }
}
