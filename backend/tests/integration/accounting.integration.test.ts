import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../src/db/prisma.js';
import { AccountingService } from '../../src/modules/accounting/accounting.service.js';

describe('Accounting Integration Tests', () => {
  beforeAll(async () => {
    // Setup test accounts if not exists
    await prisma.account.upsert({
      where: { code: '1010' },
      update: {},
      create: {
        code: '1010',
        name: 'Cash',
        type: 'ASSET',
      },
    });

    await prisma.account.upsert({
      where: { code: '4010' },
      update: {},
      create: {
        code: '4010',
        name: 'Sales Revenue',
        type: 'REVENUE',
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.journalEntry.deleteMany({});
    await prisma.ledgerEntry.deleteMany({});
  });

  beforeEach(async () => {
    // Clean up before each test
    await prisma.journalEntry.deleteMany({});
    await prisma.ledgerEntry.deleteMany({});
  });

  it('should create balanced journal entry', async () => {
    const journalEntry = await prisma.$transaction(async (tx) => {
      return AccountingService.postJournalEntryTx(tx, {
        date: new Date(),
        referenceType: 'TEST',
        referenceId: 'TEST-001',
        description: 'Test journal entry',
        userId: 'test-user',
        lines: [
          {
            accountCode: '1010',
            debit: 100,
            credit: 0,
          },
          {
            accountCode: '4010',
            debit: 0,
            credit: 100,
          },
        ],
      });
    });

    expect(journalEntry).toBeDefined();
    expect(journalEntry.status).toBe('POSTED');

    // Verify ledger entries
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { journal_entry_id: journalEntry.id },
    });

    expect(ledgerEntries).toHaveLength(2);
  });

  it('should reject unbalanced journal entry', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        return AccountingService.postJournalEntryTx(tx, {
          date: new Date(),
          referenceType: 'TEST',
          referenceId: 'TEST-002',
          description: 'Unbalanced entry',
          userId: 'test-user',
          lines: [
            {
              accountCode: '1010',
              debit: 100,
              credit: 0,
            },
            {
              accountCode: '4010',
              debit: 0,
              credit: 90, // Not balanced
            },
          ],
        });
      })
    ).rejects.toThrow('Unbalanced Journal Entry');
  });

  it('should reverse journal entry correctly', async () => {
    // Create original entry
    const original = await prisma.$transaction(async (tx) => {
      return AccountingService.postJournalEntryTx(tx, {
        date: new Date(),
        referenceType: 'TEST',
        referenceId: 'TEST-003',
        description: 'Original entry',
        userId: 'test-user',
        lines: [
          {
            accountCode: '1010',
            debit: 100,
            credit: 0,
          },
          {
            accountCode: '4010',
            debit: 0,
            credit: 100,
          },
        ],
      });
    });

    // Reverse the entry
    const { reversalEntry } = await prisma.$transaction(async (tx) => {
      return AccountingService.reverseJournalEntryTx(tx, original.id, 'test-user', 'Test reversal');
    });

    expect(reversalEntry).toBeDefined();
    expect(reversalEntry.reference_type).toBe('REVERSAL');

    // Verify original is marked as REVERSED
    const updatedOriginal = await prisma.journalEntry.findUnique({
      where: { id: original.id },
    });

    expect(updatedOriginal?.status).toBe('REVERSED');

    // Verify reversal has swapped debits and credits
    const originalLedger = await prisma.ledgerEntry.findMany({
      where: { journal_entry_id: original.id },
    });

    const reversalLedger = await prisma.ledgerEntry.findMany({
      where: { journal_entry_id: reversalEntry.id },
    });

    expect(originalLedger).toHaveLength(2);
    expect(reversalLedger).toHaveLength(2);

    // First entry: debit 100, credit 0
    // Reversal: debit 0, credit 100
    expect(Number(originalLedger[0].debit)).toBe(Number(reversalLedger[0].credit));
    expect(Number(originalLedger[0].credit)).toBe(Number(reversalLedger[0].debit));
  });

  it('should calculate trial balance correctly', async () => {
    // Create multiple journal entries
    await prisma.$transaction(async (tx) => {
      await AccountingService.postJournalEntryTx(tx, {
        date: new Date(),
        referenceType: 'TEST',
        referenceId: 'TEST-004',
        description: 'Entry 1',
        userId: 'test-user',
        lines: [
          { accountCode: '1010', debit: 100, credit: 0 },
          { accountCode: '4010', debit: 0, credit: 100 },
        ],
      });

      await AccountingService.postJournalEntryTx(tx, {
        date: new Date(),
        referenceType: 'TEST',
        referenceId: 'TEST-005',
        description: 'Entry 2',
        userId: 'test-user',
        lines: [
          { accountCode: '1010', debit: 50, credit: 0 },
          { accountCode: '4010', debit: 0, credit: 50 },
        ],
      });
    });

    const trialBalance = await AccountingService.getTrialBalance();

    expect(trialBalance.isBalanced).toBe(true);
    expect(trialBalance.grandTotalDebit).toBe(150);
    expect(trialBalance.grandTotalCredit).toBe(150);
  });
});
