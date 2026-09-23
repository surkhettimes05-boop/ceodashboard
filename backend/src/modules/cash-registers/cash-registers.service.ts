import { prisma } from '../../db/prisma.js';
import { RegisterSessionStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import Decimal from 'decimal.js';

export class CashRegistersService {
  static async getRegisters() {
    return prisma.cashRegister.findMany({
      include: {
        branch: { select: { name: true, code: true } },
        sessions: {
          orderBy: { opened_at: 'desc' },
          take: 1,
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  static async getRegisterById(id: string) {
    const register = await prisma.cashRegister.findUnique({
      where: { id },
      include: {
        branch: true,
        sessions: {
          orderBy: { opened_at: 'desc' },
          take: 10,
          include: { cashier: { select: { username: true, full_name: true } } },
        },
      },
    });

    if (!register) throw new Error('Cash register not found.');
    return register;
  }

  static async createRegister(input: { code: string; name: string; branchId: string }, userId: string) {
    const existing = await prisma.cashRegister.findUnique({ where: { code: input.code } });
    if (existing) throw new Error(`Cash register code '${input.code}' already exists.`);

    const branch = await prisma.branch.findUnique({ where: { id: input.branchId } });
    if (!branch) throw new Error('Branch not found.');

    const newRegister = await prisma.cashRegister.create({
      data: {
        code: input.code.toUpperCase(),
        name: input.name,
        branch_id: input.branchId,
      },
      include: { branch: true },
    });

    await AuditService.log({
      userId,
      action: 'CASH_REGISTER_CREATED',
      entity: 'CashRegister',
      entityId: newRegister.id,
      newValues: { code: newRegister.code, name: newRegister.name },
    });

    return newRegister;
  }

  static async openSession(registerId: string, cashierId: string, openingCash: number, userId: string) {
    const register = await prisma.cashRegister.findUnique({ where: { id: registerId } });
    if (!register) throw new Error('Cash register not found.');

    // Check if cashier has an open session
    const existingOpenSession = await prisma.registerSession.findFirst({
      where: {
        cashier_id: cashierId,
        status: RegisterSessionStatus.OPEN,
      },
    });

    if (existingOpenSession) {
      throw new Error('Cashier already has an open session. Close it before opening a new one.');
    }

    const sessionNumber = `SES-${Date.now().toString().slice(-6)}`;

    const session = await prisma.registerSession.create({
      data: {
        session_number: sessionNumber,
        register_id: registerId,
        cashier_id: cashierId,
        branch_id: register.branch_id,
        status: RegisterSessionStatus.OPEN,
        opening_cash: openingCash,
        opened_by: userId,
      },
      include: {
        register: { select: { code: true, name: true } },
        cashier: { select: { username: true, full_name: true } },
        branch: { select: { name: true, code: true } },
      },
    });

    await AuditService.log({
      userId: cashierId,
      action: 'REGISTER_SESSION_OPENED',
      entity: 'RegisterSession',
      entityId: session.id,
      newValues: { sessionNumber, openingCash, registerCode: register.code },
    });

    return session;
  }

  static async closeSession(sessionId: string, closingCash: number, userId: string, notes?: string) {
    const session = await prisma.registerSession.findUnique({
      where: { id: sessionId },
      include: { register: true },
    });

    if (!session) throw new Error('Register session not found.');
    if (session.status !== RegisterSessionStatus.OPEN) {
      throw new Error(`Session is ${session.status} and cannot be closed.`);
    }

    // Calculate expected cash based on opening cash + sales during session
    const sales = await prisma.sale.findMany({
      where: {
        cashier_id: session.cashier_id,
        branch_id: session.branch_id,
        created_at: { gte: session.opened_at },
        status: 'COMPLETED',
      },
      include: { sale_payments: true },
    });

    let cashSalesTotal = new Decimal(0);
    for (const sale of sales) {
      for (const payment of sale.sale_payments) {
        if (payment.payment_method === 'CASH') {
          cashSalesTotal = cashSalesTotal.plus(new Decimal(payment.amount));
        }
      }
    }

    const expectedCash = new Decimal(session.opening_cash).plus(cashSalesTotal);
    const actualCash = new Decimal(closingCash);
    const variance = actualCash.minus(expectedCash);

    const closedSession = await prisma.registerSession.update({
      where: { id: sessionId },
      data: {
        status: RegisterSessionStatus.CLOSED,
        closing_cash: actualCash.toNumber(),
        expected_cash: expectedCash.toNumber(),
        variance: variance.toNumber(),
        closed_at: new Date(),
        closed_by: userId,
        notes,
      },
      include: {
        register: { select: { code: true, name: true } },
        cashier: { select: { username: true, full_name: true } },
        branch: { select: { name: true, code: true } },
      },
    });

    await AuditService.log({
      userId,
      action: 'REGISTER_SESSION_CLOSED',
      entity: 'RegisterSession',
      entityId: sessionId,
      newValues: {
        sessionNumber: session.session_number,
        closingCash: actualCash.toNumber(),
        expectedCash: expectedCash.toNumber(),
        variance: variance.toNumber(),
      },
    });

    return closedSession;
  }

  static async getSessions(cashierId?: string, branchId?: string) {
    const where: any = {};
    if (cashierId) where.cashier_id = cashierId;
    if (branchId) where.branch_id = branchId;

    return prisma.registerSession.findMany({
      where,
      include: {
        register: { select: { code: true, name: true } },
        cashier: { select: { username: true, full_name: true } },
        branch: { select: { name: true, code: true } },
      },
      orderBy: { opened_at: 'desc' },
    });
  }

  static async getSessionById(id: string) {
    const session = await prisma.registerSession.findUnique({
      where: { id },
      include: {
        register: true,
        cashier: true,
        branch: true,
      },
    });

    if (!session) throw new Error('Register session not found.');
    return session;
  }

  /**
   * Approve a variance in a closed session
   * Requires manager role and variance exceeds threshold
   */
  static async approveVariance(sessionId: string, managerId: string, notes?: string) {
    const session = await prisma.registerSession.findUnique({
      where: { id: sessionId },
      include: { cashier: true },
    });

    if (!session) throw new Error('Register session not found.');
    if (session.status !== RegisterSessionStatus.CLOSED) {
      throw new Error('Only closed sessions can have variances approved.');
    }
    if (session.variance_approved) {
      throw new Error('Variance has already been approved.');
    }

    const variance = session.variance ? new Decimal(session.variance) : new Decimal(0);
    const varianceThreshold = new Decimal(100); // NPR 100 threshold for manager approval

    if (variance.abs().lessThan(varianceThreshold)) {
      throw new Error(`Variance of NPR ${variance.toString()} is below approval threshold of NPR ${varianceThreshold.toString()}. No approval required.`);
    }

    const approvedSession = await prisma.registerSession.update({
      where: { id: sessionId },
      data: {
        variance_approved: true,
        approved_by: managerId,
        approved_at: new Date(),
        notes: notes ? `${session.notes || ''} | Variance approved: ${notes}` : session.notes,
      },
      include: {
        register: { select: { code: true, name: true } },
        cashier: { select: { username: true, full_name: true } },
      },
    });

    await AuditService.log({
      userId: managerId,
      action: 'VARIANCE_APPROVED',
      entity: 'RegisterSession',
      entityId: sessionId,
      newValues: {
        sessionNumber: session.session_number,
        variance: variance.toNumber(),
        approvedBy: managerId,
      },
    });

    return approvedSession;
  }

  /**
   * Get sessions requiring variance approval
   */
  static async getSessionsNeedingApproval() {
    const varianceThreshold = 100;
    return prisma.registerSession.findMany({
      where: {
        status: RegisterSessionStatus.CLOSED,
        variance_approved: false,
        variance: {
          not: null,
        },
      },
      include: {
        register: { select: { code: true, name: true } },
        cashier: { select: { username: true, full_name: true } },
        branch: { select: { name: true, code: true } },
      },
      orderBy: { closed_at: 'desc' },
    });
  }
}
