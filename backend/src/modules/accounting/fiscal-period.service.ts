import { prisma } from '../../db/prisma.js';

export class FiscalPeriodService {
  /**
   * Get or create fiscal period for a given date
   */
  static async getPeriodForDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const period = `${year}-${month}`;

    let fiscalPeriod = await prisma.fiscalPeriod.findUnique({
      where: { period },
    });

    if (!fiscalPeriod) {
      fiscalPeriod = await prisma.fiscalPeriod.create({
        data: {
          period,
          status: 'OPEN',
          openedBy: 'SYSTEM', // Will be overridden if user provided
        },
      });
    }

    return fiscalPeriod;
  }

  /**
   * Check if a date falls within a closed period
   */
  static async isPeriodClosed(date: Date) {
    const fiscalPeriod = await this.getPeriodForDate(date);
    return fiscalPeriod.status === 'CLOSED';
  }

  /**
   * Close a fiscal period
   */
  static async closePeriod(period: string, userId: string) {
    const fiscalPeriod = await prisma.fiscalPeriod.findUnique({
      where: { period },
    });

    if (!fiscalPeriod) {
      throw new Error(`Fiscal period ${period} not found.`);
    }

    if (fiscalPeriod.status === 'CLOSED') {
      throw new Error(`Fiscal period ${period} is already closed.`);
    }

    const updated = await prisma.fiscalPeriod.update({
      where: { period },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedBy: userId,
      },
    });

    return updated;
  }

  /**
   * Reopen a fiscal period (requires authorization)
   */
  static async reopenPeriod(period: string, userId: string) {
    const fiscalPeriod = await prisma.fiscalPeriod.findUnique({
      where: { period },
    });

    if (!fiscalPeriod) {
      throw new Error(`Fiscal period ${period} not found.`);
    }

    if (fiscalPeriod.status !== 'CLOSED') {
      throw new Error(`Fiscal period ${period} is not closed.`);
    }

    const updated = await prisma.fiscalPeriod.update({
      where: { period },
      data: {
        status: 'OPEN',
        reopenedAt: new Date(),
        reopenedBy: userId,
      },
    });

    return updated;
  }

  /**
   * Get all fiscal periods
   */
  static async getFiscalPeriods() {
    return prisma.fiscalPeriod.findMany({
      orderBy: { period: 'desc' },
    });
  }

  /**
   * Validate that a journal entry date is not in a closed period
   */
  static async validatePeriodOpen(date: Date) {
    const isClosed = await this.isPeriodClosed(date);
    if (isClosed) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      throw new Error(`Cannot post to closed fiscal period ${year}-${month}. Period must be reopened first.`);
    }
  }
}
