import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';
import { bootstrapAuditDatabase, getAuditDatabaseUrl } from './bootstrap.js';

const prisma = new PrismaClient({ datasourceUrl: getAuditDatabaseUrl() });

async function main() {
  console.log('\n=== LEDGER INTEGRITY ===');
  bootstrapAuditDatabase();

  const accounts = await prisma.account.findMany({ include: { ledger_entries: true } });
  let totalDebits = new Decimal(0);
  let totalCredits = new Decimal(0);
  let journalIssueCount = 0;

  for (const journal of await prisma.journalEntry.findMany({ include: { ledger_entries: true } })) {
    const entryDebit = journal.ledger_entries.reduce((sum, entry) => sum.plus(new Decimal(entry.debit)), new Decimal(0));
    const entryCredit = journal.ledger_entries.reduce((sum, entry) => sum.plus(new Decimal(entry.credit)), new Decimal(0));
    totalDebits = totalDebits.plus(entryDebit);
    totalCredits = totalCredits.plus(entryCredit);

    if (!entryDebit.equals(entryCredit)) {
      journalIssueCount += 1;
      console.log(`[ledger] Unbalanced journal ${journal.entry_number}: ${entryDebit.toString()} / ${entryCredit.toString()}`);
    }
  }

  for (const account of accounts) {
    const debit = account.ledger_entries.reduce((sum, entry) => sum.plus(new Decimal(entry.debit)), new Decimal(0));
    const credit = account.ledger_entries.reduce((sum, entry) => sum.plus(new Decimal(entry.credit)), new Decimal(0));
    if (!debit.equals(credit) && account.type !== 'ASSET' && account.type !== 'LIABILITY' && account.type !== 'EQUITY') {
      console.log(`[ledger] Account ${account.code} may not be in balance state; debit=${debit.toString()}, credit=${credit.toString()}`);
    }
  }

  console.log(`[ledger] Grand total debit=${totalDebits.toString()}`);
  console.log(`[ledger] Grand total credit=${totalCredits.toString()}`);
  console.log(`[ledger] Journal imbalance count=${journalIssueCount}`);

  const supportedFlows = {
    cashSale: 'exists',
    b2bSale: 'exists',
    saleWithDiscount: 'exists',
    saleWithVat: 'exists',
    stockAdjustment: 'exists',
    purchaseReceipt: 'exists',
    customerPayment: 'not implemented as dedicated payment endpoint',
    supplierPayment: 'not implemented as dedicated payment endpoint',
    salesReturnRefund: 'no refund API or service is present',
  };

  console.log('[ledger] Flow status:');
  for (const [flow, status] of Object.entries(supportedFlows)) {
    console.log(`  - ${flow}: ${status}`);
  }

  if (journalIssueCount > 0 || !totalDebits.equals(totalCredits)) {
    throw new Error(`Ledger integrity check failed: ${journalIssueCount} journal issues, total debit != total credit.`);
  }

  console.log('[ledger] PASS');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
