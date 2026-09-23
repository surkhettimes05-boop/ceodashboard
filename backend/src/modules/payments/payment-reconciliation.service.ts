import { prisma } from '../../db/prisma.js';
import { PaymentMethod, PaymentReconciliationStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import Decimal from 'decimal.js';

export class PaymentReconciliationService {
  /**
   * Reconcile payments for a register session
   * Compares expected payments (from sales) vs actual payments (from bank/card records)
   */
  static async reconcileSession(sessionId: string, actualPayments: Array<{ method: PaymentMethod; amount: number }>, userId: string) {
    const session = await prisma.registerSession.findUnique({
      where: { id: sessionId },
      include: { branch: true, cashier: true },
    });

    if (!session) throw new Error('Register session not found.');
    if (session.status !== 'CLOSED') {
      throw new Error('Only closed sessions can be reconciled.');
    }

    // Get expected payments from sales during the session
    const sales = await prisma.sale.findMany({
      where: {
        cashier_id: session.cashier_id,
        branch_id: session.branch_id,
        created_at: { gte: session.opened_at, lte: session.closed_at || new Date() },
        status: 'COMPLETED',
      },
      include: { sale_payments: true },
    });

    // Calculate expected amounts by payment method
    const expectedByMethod = new Map<PaymentMethod, Decimal>();
    for (const sale of sales) {
      for (const payment of sale.sale_payments) {
        const current = expectedByMethod.get(payment.payment_method) || new Decimal(0);
        expectedByMethod.set(payment.payment_method, current.plus(new Decimal(payment.amount)));
      }
    }

    // Create reconciliation records
    const reconciliations = [];
    const allMethods = new Set([...expectedByMethod.keys(), ...actualPayments.map(p => p.method)]);

    for (const method of allMethods) {
      const expected = expectedByMethod.get(method) || new Decimal(0);
      const actual = new Decimal(actualPayments.find(p => p.method === method)?.amount || 0);
      const discrepancy = actual.minus(expected);
      const status = discrepancy.abs().equals(0) ? PaymentReconciliationStatus.MATCHED : PaymentReconciliationStatus.DISCREPANCY;

      const reconciliation = await prisma.paymentReconciliation.create({
        data: {
          session_id: sessionId,
          payment_method: method,
          expected_amount: expected.toNumber(),
          actual_amount: actual.toNumber(),
          discrepancy: discrepancy.toNumber(),
          status,
        },
      });

      reconciliations.push(reconciliation);
    }

    await AuditService.log({
      userId,
      action: 'PAYMENT_RECONCILIATION_CREATED',
      entity: 'PaymentReconciliation',
      entityId: sessionId,
      newValues: {
        sessionNumber: session.session_number,
        reconciliationsCount: reconciliations.length,
        discrepanciesCount: reconciliations.filter(r => r.status === PaymentReconciliationStatus.DISCREPANCY).length,
      },
    });

    return reconciliations;
  }

  /**
   * Resolve a payment discrepancy
   */
  static async resolveDiscrepancy(reconciliationId: string, userId: string, notes: string) {
    const reconciliation = await prisma.paymentReconciliation.findUnique({
      where: { id: reconciliationId },
      include: { session: true },
    });

    if (!reconciliation) throw new Error('Payment reconciliation record not found.');
    if (reconciliation.status === PaymentReconciliationStatus.MATCHED) {
      throw new Error('This reconciliation is already matched. No resolution needed.');
    }
    if (reconciliation.status === PaymentReconciliationStatus.RESOLVED) {
      throw new Error('This discrepancy has already been resolved.');
    }

    const resolved = await prisma.paymentReconciliation.update({
      where: { id: reconciliationId },
      data: {
        status: PaymentReconciliationStatus.RESOLVED,
        notes: notes,
        reconciled_by: userId,
        reconciled_at: new Date(),
      },
    });

    await AuditService.log({
      userId,
      action: 'PAYMENT_DISCREPANCY_RESOLVED',
      entity: 'PaymentReconciliation',
      entityId: reconciliationId,
      newValues: {
        paymentMethod: reconciliation.payment_method,
        discrepancy: reconciliation.discrepancy,
        notes,
      },
    });

    return resolved;
  }

  /**
   * Get reconciliations for a session
   */
  static async getSessionReconciliations(sessionId: string) {
    return prisma.paymentReconciliation.findMany({
      where: { session_id: sessionId },
      orderBy: { payment_method: 'asc' },
    });
  }

  /**
   * Get all pending reconciliations (discrepancies needing resolution)
   */
  static async getPendingReconciliations() {
    return prisma.paymentReconciliation.findMany({
      where: {
        status: PaymentReconciliationStatus.DISCREPANCY,
      },
      include: {
        session: {
          include: {
            register: { select: { code: true, name: true } },
            cashier: { select: { username: true, full_name: true } },
            branch: { select: { name: true, code: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Get reconciliation summary by date range
   */
  static async getReconciliationSummary(startDate: Date, endDate: Date) {
    const reconciliations = await prisma.paymentReconciliation.findMany({
      where: {
        created_at: { gte: startDate, lte: endDate },
      },
      include: {
        session: {
          include: { branch: { select: { name: true } } },
        },
      },
    });

    const summary = {
      totalReconciliations: reconciliations.length,
      matched: reconciliations.filter(r => r.status === PaymentReconciliationStatus.MATCHED).length,
      discrepancies: reconciliations.filter(r => r.status === PaymentReconciliationStatus.DISCREPANCY).length,
      resolved: reconciliations.filter(r => r.status === PaymentReconciliationStatus.RESOLVED).length,
      totalDiscrepancyAmount: reconciliations.reduce((sum, r) => sum + Math.abs(Number(r.discrepancy)), 0),
      byBranch: {} as Record<string, { matched: number; discrepancies: number; resolved: number }>,
    };

    for (const r of reconciliations) {
      const branchName = r.session.branch?.name || 'Unknown';
      if (!summary.byBranch[branchName]) {
        summary.byBranch[branchName] = { matched: 0, discrepancies: 0, resolved: 0 };
      }
      if (r.status === PaymentReconciliationStatus.MATCHED) summary.byBranch[branchName].matched++;
      if (r.status === PaymentReconciliationStatus.DISCREPANCY) summary.byBranch[branchName].discrepancies++;
      if (r.status === PaymentReconciliationStatus.RESOLVED) summary.byBranch[branchName].resolved++;
    }

    return summary;
  }
}
