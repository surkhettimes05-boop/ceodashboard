import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';
import { bootstrapAuditDatabase, getAuditDatabaseUrl } from './bootstrap.js';

const prisma = new PrismaClient({ datasourceUrl: getAuditDatabaseUrl() });

async function main() {
  console.log('\n=== STOCK RECONCILIATION ===');
  bootstrapAuditDatabase();

  const products = await prisma.product.findMany({ include: { stock_balances: true, inventory_logs: true } });
  let mismatches = 0;

  for (const product of products) {
    const grouped = new Map<string, Decimal>();
    for (const movement of product.inventory_logs) {
      const key = `${movement.location_type}:${movement.location_id}`;
      const current = grouped.get(key) ?? new Decimal(0);
      grouped.set(key, current.plus(new Decimal(movement.quantity)));
    }

    for (const balance of product.stock_balances) {
      const key = `${balance.location_type}:${balance.location_id}`;
      const movementTotal = grouped.get(key) ?? new Decimal(0);
      const diff = new Decimal(balance.quantity).minus(movementTotal);
      if (!diff.equals(0)) {
        mismatches += 1;
        console.log(`[stock] Mismatch: product=${product.name} location=${balance.location_id} stockBalance=${balance.quantity} movementTotal=${movementTotal.toString()} diff=${diff.toString()}`);
      }
    }
  }

  if (mismatches > 0) {
    throw new Error(`Stock reconciliation failed with ${mismatches} mismatches.`);
  }

  console.log(`[stock] No mismatches across ${products.length} products.`);
  console.log('[stock] PASS');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
