import { prisma } from '../../db/prisma.js';
import { AccountType } from '@prisma/client';
import Decimal from 'decimal.js';
import { FiscalPeriodService } from './fiscal-period.service.js';

export interface JournalLineInput {
  accountCode: string;
  debit: number | Decimal;
  credit: number | Decimal;
}

export interface PostJournalParams {
  date?: Date;
  referenceType: string;
  referenceId: string;
  description: string;
  userId: string;
  lines: JournalLineInput[];
  status?: 'DRAFT' | 'POSTED';
}

export class AccountingService {
  static resolvePaymentAccountCode(paymentMethod: string): string {
    const method = String(paymentMethod || '').toUpperCase();

    switch (method) {
      case 'CASH':
        return '1010';
      case 'CARD':
      case 'MOBILE_MONEY':
      case 'BANK_TRANSFER':
        return '1020';
      case 'CREDIT':
        return '1030';
      default:
        return '1010';
    }
  }

  static resolveRevenueAccountCode(channel: string): string {
    const normalized = String(channel || '').toUpperCase();
    return normalized === 'B2B' ? '4020' : '4010';
  }

  static calculateFinancialMetrics(input: { revenue: number; cogs: number; operatingExpenses: number }) {
    const revenue = new Decimal(input.revenue || 0);
    const cogs = new Decimal(input.cogs || 0);
    const operatingExpenses = new Decimal(input.operatingExpenses || 0);

    const grossProfit = revenue.minus(cogs);
    const operatingProfit = grossProfit.minus(operatingExpenses);
    const grossMargin = revenue.isZero() ? 0 : grossProfit.dividedBy(revenue).times(100).toNumber();

    return {
      revenue: revenue.toNumber(),
      cogs: cogs.toNumber(),
      grossProfit: grossProfit.toNumber(),
      operatingExpenses: operatingExpenses.toNumber(),
      operatingProfit: operatingProfit.toNumber(),
      grossMargin,
    };
  }

  /**
   * Helper function to post a balanced Journal Entry inside a transaction
   */
  static async postJournalEntryTx(tx: any, params: PostJournalParams) {
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    for (const line of params.lines) {
      totalDebit = totalDebit.plus(new Decimal(line.debit));
      totalCredit = totalCredit.plus(new Decimal(line.credit));
    }

    if (!totalDebit.equals(totalCredit)) {
      throw new Error(`Unbalanced Journal Entry! Total Debits ($${totalDebit.toString()}) must equal Total Credits ($${totalCredit.toString()})`);
    }

    // Validate fiscal period is open for the entry date
    const entryDate = params.date || new Date();
    await FiscalPeriodService.validatePeriodOpen(entryDate);

    const entryNumber = `JE-${Date.now().toString().slice(-6)}`;

    // Create Journal Entry Record with status
    const journalEntry = await tx.journalEntry.create({
      data: {
        entry_number: entryNumber,
        date: entryDate,
        reference_type: params.referenceType,
        reference_id: params.referenceId,
        description: params.description,
        status: params.status || 'POSTED',
        created_by: params.userId,
      },
    });

    // Create Ledger Line Items
    for (const line of params.lines) {
      const account = await tx.account.findUnique({ where: { code: line.accountCode } });
      if (!account) {
        throw new Error(`Account code '${line.accountCode}' not found in Chart of Accounts.`);
      }

      await tx.ledgerEntry.create({
        data: {
          journal_entry_id: journalEntry.id,
          account_id: account.id,
          debit: new Decimal(line.debit).toNumber(),
          credit: new Decimal(line.credit).toNumber(),
        },
      });
    }

    return journalEntry;
  }

  /**
   * Reverse a posted journal entry by creating an opposite entry
   * This preserves the original entry for audit trail
   */
  static async reverseJournalEntryTx(tx: any, originalEntryId: string, userId: string, reason: string) {
    const originalEntry = await tx.journalEntry.findUnique({
      where: { id: originalEntryId },
      include: { ledger_entries: { include: { account: { select: { id: true, code: true } } } } },
    });

    if (!originalEntry) {
      throw new Error('Original journal entry not found.');
    }

    if (originalEntry.status === 'REVERSED') {
      throw new Error('Journal entry has already been reversed.');
    }

    if (originalEntry.status !== 'POSTED') {
      throw new Error('Only POSTED journal entries can be reversed.');
    }

    // Create reversal lines (swap debits and credits)
    const reversalLines = originalEntry.ledger_entries.map((entry: any) => ({
      accountId: entry.account.id,
      debit: entry.credit,
      credit: entry.debit,
    }));

    const reversalEntry = await tx.journalEntry.create({
      data: {
        entry_number: `REV-${Date.now().toString().slice(-6)}`,
        date: new Date(),
        reference_type: 'REVERSAL',
        reference_id: originalEntry.id,
        description: `Reversal of ${originalEntry.entry_number}: ${reason}`,
        status: 'POSTED',
        reversal_of_journal_entry_id: originalEntry.id,
        reversed_by: userId,
        reversed_at: new Date(),
        reversal_reason: reason,
        created_by: userId,
      },
    });

    for (const line of reversalLines) {
      await tx.ledgerEntry.create({
        data: {
          journal_entry_id: reversalEntry.id,
          account_id: line.accountId,
          debit: new Decimal(line.debit).toNumber(),
          credit: new Decimal(line.credit).toNumber(),
        },
      });
    }

    // Mark original entry as REVERSED
    await tx.journalEntry.update({
      where: { id: originalEntryId },
      data: { status: 'REVERSED' },
    });

    return { originalEntry, reversalEntry };
  }

  static async getAccountBalancesSnapshot() {
    const accounts = await prisma.account.findMany({
      where: { code: { in: ['1010', '1020', '1030', '1040', '2010'] } },
      include: { ledger_entries: true },
    });

    const balances: Record<string, number> = {
      '1010': 0,
      '1020': 0,
      '1030': 0,
      '1040': 0,
      '2010': 0,
    };

    for (const account of accounts) {
      let total = new Decimal(0);
      for (const entry of account.ledger_entries) {
        total = total.plus(new Decimal(entry.debit)).minus(new Decimal(entry.credit));
      }
      balances[account.code] = total.toNumber();
    }

    return {
      cashAndBank: (balances['1010'] || 0) + (balances['1020'] || 0),
      accountsReceivable: balances['1030'] || 0,
      inventoryAssetValue: balances['1040'] || 0,
      accountsPayable: balances['2010'] || 0,
    };
  }

  static async getAccounts() {
    return prisma.account.findMany({
      include: {
        _count: { select: { ledger_entries: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  static async getGeneralLedger(accountId?: string) {
    const where: any = {};
    if (accountId) where.account_id = accountId;

    return prisma.ledgerEntry.findMany({
      where,
      include: {
        account: { select: { code: true, name: true, type: true } },
        journal_entry: { select: { entry_number: true, date: true, reference_type: true, reference_id: true, description: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 200,
    });
  }

  /**
   * Financial Statement: Profit & Loss Statement (Revenue - COGS - Expenses = Net Profit)
   */
  static async getProfitAndLoss() {
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      include: {
        account: { select: { code: true, name: true, type: true } },
      },
    });

    let totalRevenue = new Decimal(0);
    let totalCogs = new Decimal(0);
    let totalOperatingExpenses = new Decimal(0);

    for (const entry of ledgerEntries) {
      const net = new Decimal(entry.credit).minus(new Decimal(entry.debit));
      if (entry.account.type === AccountType.REVENUE) {
        totalRevenue = totalRevenue.plus(net);
      } else if (entry.account.code === '5010') { // COGS Account
        totalCogs = totalCogs.plus(new Decimal(entry.debit).minus(new Decimal(entry.credit)));
      } else if (entry.account.type === AccountType.EXPENSE) {
        totalOperatingExpenses = totalOperatingExpenses.plus(new Decimal(entry.debit).minus(new Decimal(entry.credit)));
      }
    }

    const grossProfit = totalRevenue.minus(totalCogs);
    const netProfit = grossProfit.minus(totalOperatingExpenses);

    return {
      revenue: totalRevenue.toNumber(),
      cogs: totalCogs.toNumber(),
      grossProfit: grossProfit.toNumber(),
      operatingExpenses: totalOperatingExpenses.toNumber(),
      netProfit: netProfit.toNumber(),
    };
  }

  /**
   * Financial Statement: Trial Balance (Sum of Debits & Credits per Account)
   */
  static async getTrialBalance() {
    const accounts = await prisma.account.findMany({
      include: {
        ledger_entries: true,
      },
      orderBy: { code: 'asc' },
    });

    let grandTotalDebit = new Decimal(0);
    let grandTotalCredit = new Decimal(0);

    const rows = accounts.map((acc) => {
      let debitSum = new Decimal(0);
      let creditSum = new Decimal(0);

      for (const entry of acc.ledger_entries) {
        debitSum = debitSum.plus(new Decimal(entry.debit));
        creditSum = creditSum.plus(new Decimal(entry.credit));
      }

      grandTotalDebit = grandTotalDebit.plus(debitSum);
      grandTotalCredit = grandTotalCredit.plus(creditSum);

      return {
        code: acc.code,
        name: acc.name,
        type: acc.type,
        debit: debitSum.toNumber(),
        credit: creditSum.toNumber(),
      };
    });

    return {
      rows,
      grandTotalDebit: grandTotalDebit.toNumber(),
      grandTotalCredit: grandTotalCredit.toNumber(),
      isBalanced: grandTotalDebit.equals(grandTotalCredit),
    };
  }
}
