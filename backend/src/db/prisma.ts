import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

// Middleware to enforce financial immutability
prisma.$use(async (params, next) => {
  // Prevent modification of POSTED journal entries
  if (params.model === 'JournalEntry') {
    if (params.action === 'update' || params.action === 'delete') {
      const existing = await prisma.journalEntry.findUnique({
        where: params.args.where as any,
      });

      const isAllowedReversalStatusUpdate =
        params.action === 'update'
        && existing?.status === 'POSTED'
        && params.args.data?.status === 'REVERSED';

      if (existing && existing.status === 'POSTED' && !isAllowedReversalStatusUpdate) {
        throw new Error('Cannot modify or delete POSTED journal entries. Use reversal instead.');
      }
    }
  }

  // Prevent modification of ledger entries (they are immutable once created)
  if (params.model === 'LedgerEntry') {
    if (params.action === 'update' || params.action === 'delete') {
      throw new Error('Ledger entries are immutable and cannot be modified or deleted.');
    }
  }

  return next(params);
});

export { prisma };
