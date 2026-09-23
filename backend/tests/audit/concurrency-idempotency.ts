import { PrismaClient } from '@prisma/client';
import { bootstrapAuditDatabase, getAuditDatabaseUrl } from './bootstrap.js';
import { SalesService } from '../../src/modules/sales/sales.service.js';

const prisma = new PrismaClient({ datasourceUrl: getAuditDatabaseUrl() });

async function main() {
  console.log('\n=== CONCURRENCY + IDEMPOTENCY ===');
  bootstrapAuditDatabase();

  const cashier = await prisma.user.findUnique({ where: { username: 'cashier' } });
  const branch = await prisma.branch.findFirst();
  const product = await prisma.product.findFirst();

  if (!cashier || !branch || !product) {
    throw new Error('Audit setup missing cashier/branch/product.');
  }

  await prisma.stockBalance.upsert({
    where: { product_id_location_id: { product_id: product.id, location_id: branch.id } },
    update: { quantity: 1 },
    create: { product_id: product.id, location_type: 'BRANCH', location_id: branch.id, quantity: 1 },
  });

  const baseInput = {
    branchId: branch.id,
    channel: 'RETAIL' as const,
    items: [{ productId: product.id, quantity: 1, unitPrice: Number(product.selling_price) }],
    payments: [{ paymentMethod: 'CASH' as const, amount: Number(product.selling_price) }],
  };

  const originalDateNow = Date.now;
  let clock = 0;
  Date.now = () => originalDateNow() + clock++;

  const results = await Promise.allSettled([
    SalesService.createSaleTransaction(baseInput, cashier.id),
    SalesService.createSaleTransaction(baseInput, cashier.id),
  ]);

  Date.now = originalDateNow;

  const successes = results.filter((r) => r.status === 'fulfilled').length;
  const failures = results.filter((r) => r.status === 'rejected').length;

  console.log(`[concurrency] success=${successes} failure=${failures}`);
  console.log(`[concurrency] sale count=${await prisma.sale.count()}`);
  const stock = await prisma.stockBalance.findFirst({ where: { product_id: product.id, location_id: branch.id } });
  console.log(`[concurrency] stock=${String(stock?.quantity ?? 0)}`);

  if (successes !== 1 || Number(stock?.quantity ?? 0) < 0) {
    throw new Error(`Concurrency bug reproduced: expected exactly one sale to succeed, got ${successes}.`);
  }

  console.log('[concurrency] PASS');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
