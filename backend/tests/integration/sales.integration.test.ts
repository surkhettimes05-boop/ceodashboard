import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../src/db/prisma.js';
import { SalesService } from '../../src/modules/sales/sales.service.js';
import { InventoryService } from '../../src/modules/inventory/inventory.service.js';

describe('Sales Integration Tests', () => {
  let testProductId: string;
  let testCategoryId: string;
  let testUnitId: string;
  let testBranchId: string;
  let testCashierId: string;
  let testRoleId: string;

  beforeAll(async () => {
    const branch = await prisma.branch.create({
      data: { name: 'Integration Test Branch', code: `TEST-BRN-${Date.now()}` },
    });
    testBranchId = branch.id;

    const role = await prisma.role.upsert({
      where: { name: 'CASHIER' },
      update: {},
      create: { name: 'CASHIER', description: 'Integration test cashier' },
    });
    testRoleId = role.id;

    const user = await prisma.user.create({
      data: {
        username: `testcashier-${Date.now()}`,
        email: `testcashier-${Date.now()}@example.com`,
        full_name: 'Integration Test Cashier',
        password_hash: 'test-hash',
        role_id: testRoleId,
        branch_id: testBranchId,
      },
    });
    testCashierId = user.id;

    const category = await prisma.category.create({ data: { name: `Test Category ${Date.now()}` } });
    testCategoryId = category.id;
    const unit = await prisma.unit.create({ data: { name: `Test Unit ${Date.now()}`, abbreviation: 'pc' } });
    testUnitId = unit.id;

    const product = await prisma.product.create({
      data: {
        sku: `PROD-TEST-${Date.now()}`,
        name: 'Integration Test Product',
        selling_price: 100,
        cost_price: 50,
        min_stock_level: 10,
        category_id: testCategoryId,
        unit_id: testUnitId,
      },
    });
    testProductId = product.id;

    await InventoryService.createStockAdjustment({
      productId: testProductId,
      locationType: 'BRANCH',
      locationId: testBranchId,
      movementType: 'ADJUSTMENT',
      quantity: 100,
      unitCost: 50,
      notes: 'Integration test opening stock',
    }, testCashierId);
  });

  beforeEach(async () => {
    await prisma.sale.deleteMany({ where: { cashier_id: testCashierId } });
  });

  afterAll(async () => {
    await prisma.sale.deleteMany({ where: { cashier_id: testCashierId } });
    await prisma.inventoryTransaction.deleteMany({ where: { product_id: testProductId } });
    await prisma.stockBalance.deleteMany({ where: { product_id: testProductId } });
    await prisma.product.delete({ where: { id: testProductId } });
    await prisma.category.delete({ where: { id: testCategoryId } });
    await prisma.unit.delete({ where: { id: testUnitId } });
    await prisma.user.delete({ where: { id: testCashierId } });
    await prisma.branch.delete({ where: { id: testBranchId } });
  });

  const createSale = (unitPrice: number, amount: number) => SalesService.createSaleTransaction({
    branchId: testBranchId,
    channel: 'RETAIL',
    discountAmount: 0,
    taxAmount: 0,
    items: [{ productId: testProductId, quantity: 1, unitPrice }],
    payments: [{ paymentMethod: 'CASH', amount }],
  }, testCashierId, { role: 'CASHIER', branchId: testBranchId });

  it('uses the catalog price and posts balanced accounting entries', async () => {
    const sale = await createSale(1, 100);

    expect(Number(sale.total_amount)).toBe(100);
    const journalEntry = await prisma.journalEntry.findFirst({
      where: { reference_type: 'SALE', reference_id: sale.id },
      include: { ledger_entries: true },
    });
    expect(journalEntry?.status).toBe('POSTED');
    const totalDebit = journalEntry?.ledger_entries.reduce((sum, entry) => sum + Number(entry.debit), 0) || 0;
    const totalCredit = journalEntry?.ledger_entries.reduce((sum, entry) => sum + Number(entry.credit), 0) || 0;
    expect(totalDebit).toBe(totalCredit);
  });

  it('voids a sale and creates a valid reversal entry', async () => {
    const sale = await createSale(100, 100);

    await SalesService.voidSale(sale.id, testCashierId, 'Integration test void');

    const reversalEntry = await prisma.journalEntry.findFirst({
      where: { reference_type: 'REVERSAL', reversal_of_journal_entry_id: { not: null } },
      include: { ledger_entries: true },
    });
    expect(reversalEntry).toBeDefined();
    expect(reversalEntry?.ledger_entries).toHaveLength(4);

    const voidedSale = await prisma.sale.findUnique({ where: { id: sale.id } });
    expect(voidedSale?.status).toBe('VOIDED');
  });

  it('rejects a cashier sale for another branch', async () => {
    const otherBranch = await prisma.branch.create({ data: { name: 'Other Test Branch', code: `TEST-OTHER-${Date.now()}` } });
    await expect(SalesService.createSaleTransaction({
      branchId: otherBranch.id,
      channel: 'RETAIL',
      taxAmount: 0,
      items: [{ productId: testProductId, quantity: 1, unitPrice: 100 }],
      payments: [{ paymentMethod: 'CASH', amount: 100 }],
    }, testCashierId, { role: 'CASHIER', branchId: testBranchId })).rejects.toThrow('assigned branch');
    await prisma.branch.delete({ where: { id: otherBranch.id } });
  });
});
