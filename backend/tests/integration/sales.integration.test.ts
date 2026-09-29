import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../src/db/prisma.js';
import { SalesService } from '../../src/modules/sales/sales.service.js';
import { InventoryService } from '../../src/modules/inventory/inventory.service.js';
import { StoreReportingService } from '../../src/modules/reporting/store-reporting.service.js';
import { ProductsService } from '../../src/modules/products/products.service.js';

describe('Sales Integration Tests', () => {
  let testProductId: string;
  let testCategoryId: string;
  let testUnitId: string;
  let testBranchId: string;
  let otherBranchId: string;
  let thirdBranchId: string;
  let testCashierId: string;
  let testRoleId: string;

  beforeAll(async () => {
    const branch = await prisma.branch.create({
      data: { name: 'Integration Test Branch', code: `TEST-BRN-${Date.now()}` },
    });
    testBranchId = branch.id;
    const otherBranch = await prisma.branch.create({ data: { name: 'Integration Test Branch 2', code: `TEST-BRN2-${Date.now()}` } });
    otherBranchId = otherBranch.id;
    const thirdBranch = await prisma.branch.create({ data: { name: 'Integration Test Branch 3', code: `TEST-BRN3-${Date.now()}` } });
    thirdBranchId = thirdBranch.id;

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
    await prisma.stockBalance.upsert({ where: { product_id_location_id: { product_id: testProductId, location_id: testBranchId } }, update: { quantity: 100 }, create: { product_id: testProductId, location_type: 'BRANCH', location_id: testBranchId, quantity: 100 } });
    await prisma.stockBalance.upsert({ where: { product_id_location_id: { product_id: testProductId, location_id: otherBranchId } }, update: { quantity: 20 }, create: { product_id: testProductId, location_type: 'BRANCH', location_id: otherBranchId, quantity: 20 } });
    await prisma.stockBalance.upsert({ where: { product_id_location_id: { product_id: testProductId, location_id: thirdBranchId } }, update: { quantity: 10 }, create: { product_id: testProductId, location_type: 'BRANCH', location_id: thirdBranchId, quantity: 10 } });
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
    await prisma.stockBalance.deleteMany({ where: { location_id: otherBranchId } });
    await prisma.stockBalance.deleteMany({ where: { location_id: thirdBranchId } });
    await prisma.branch.delete({ where: { id: otherBranchId } });
    await prisma.branch.delete({ where: { id: thirdBranchId } });
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
    const journalCountBefore = await prisma.journalEntry.count({ where: { reference_type: 'SALE' } });
    await expect(SalesService.createSaleTransaction({
      branchId: otherBranchId,
      channel: 'RETAIL',
      taxAmount: 0,
      items: [{ productId: testProductId, quantity: 1, unitPrice: 100 }],
      payments: [{ paymentMethod: 'CASH', amount: 100 }],
    }, testCashierId, { role: 'CASHIER', branchId: testBranchId })).rejects.toMatchObject({ statusCode: 403 });
    expect(await prisma.sale.count({ where: { branch_id: otherBranchId } })).toBe(0);
    expect(await prisma.salePayment.count({ where: { sale: { branch_id: otherBranchId } } })).toBe(0);
    expect(await prisma.journalEntry.count({ where: { reference_type: 'SALE' } })).toBe(journalCountBefore);
    expect(Number((await prisma.stockBalance.findUnique({ where: { product_id_location_id: { product_id: testProductId, location_id: otherBranchId } } }))?.quantity)).toBe(20);
  });

  it('deducts only the selling branch stock and rejects insufficient stock atomically', async () => {
    await prisma.stockBalance.update({ where: { product_id_location_id: { product_id: testProductId, location_id: testBranchId } }, data: { quantity: 30 } });
    const otherCashier = await prisma.user.create({ data: { username: `scenario2-${Date.now()}`, email: `scenario2-${Date.now()}@example.com`, full_name: 'Store 2 Cashier', password_hash: 'test', role_id: testRoleId, branch_id: otherBranchId } });
    const thirdCashier = await prisma.user.create({ data: { username: `scenario3-${Date.now()}`, email: `scenario3-${Date.now()}@example.com`, full_name: 'Store 3 Cashier', password_hash: 'test', role_id: testRoleId, branch_id: thirdBranchId } });
    try {
    const scenarioStart = new Date(Date.now() - 1000);
    await SalesService.createSaleTransaction({
      branchId: testBranchId, channel: 'RETAIL', taxAmount: 0,
      items: [{ productId: testProductId, quantity: 2, unitPrice: 100 }],
      payments: [{ paymentMethod: 'CASH', amount: 200 }],
    }, testCashierId, { role: 'CASHIER', branchId: testBranchId });
    await SalesService.createSaleTransaction({ branchId: otherBranchId, channel: 'RETAIL', taxAmount: 0,
      items: [{ productId: testProductId, quantity: 5, unitPrice: 100 }], payments: [{ paymentMethod: 'CASH', amount: 500 }],
    }, otherCashier.id, { role: 'CASHIER', branchId: otherBranchId });
    await SalesService.createSaleTransaction({ branchId: thirdBranchId, channel: 'RETAIL', taxAmount: 0,
      items: [{ productId: testProductId, quantity: 1, unitPrice: 100 }], payments: [{ paymentMethod: 'CASH', amount: 100 }],
    }, thirdCashier.id, { role: 'CASHIER', branchId: thirdBranchId });
    const branchOne = await prisma.stockBalance.findUnique({ where: { product_id_location_id: { product_id: testProductId, location_id: testBranchId } } });
    const branchTwo = await prisma.stockBalance.findUnique({ where: { product_id_location_id: { product_id: testProductId, location_id: otherBranchId } } });
    const branchThree = await prisma.stockBalance.findUnique({ where: { product_id_location_id: { product_id: testProductId, location_id: thirdBranchId } } });
    expect(Number(branchOne?.quantity)).toBe(28);
    expect(Number(branchTwo?.quantity)).toBe(15);
    expect(Number(branchThree?.quantity)).toBe(9);
    const scenarioReport = await StoreReportingService.getDailySummary(scenarioStart, new Date(Date.now() + 1000));
    expect(scenarioReport.sales).toBe(800);
    expect(scenarioReport.orderCount).toBe(3);
    expect(scenarioReport.byStore.find((store) => store.branchId === testBranchId)?.sales).toBe(200);
    expect(scenarioReport.byStore.find((store) => store.branchId === otherBranchId)?.sales).toBe(500);
    expect(scenarioReport.byStore.find((store) => store.branchId === thirdBranchId)?.sales).toBe(100);

    await prisma.stockBalance.update({ where: { product_id_location_id: { product_id: testProductId, location_id: testBranchId } }, data: { quantity: 1 } });
    await prisma.sale.deleteMany({ where: { cashier_id: testCashierId } });
    const journalCountBeforeFailure = await prisma.journalEntry.count({ where: { reference_type: 'SALE' } });
    await expect(SalesService.createSaleTransaction({
      branchId: testBranchId, channel: 'RETAIL', taxAmount: 0,
      items: [{ productId: testProductId, quantity: 2, unitPrice: 100 }],
      payments: [{ paymentMethod: 'CASH', amount: 200 }],
    }, testCashierId, { role: 'CASHIER', branchId: testBranchId })).rejects.toThrow('Insufficient stock');
    expect(Number((await prisma.stockBalance.findUnique({ where: { product_id_location_id: { product_id: testProductId, location_id: testBranchId } } }))?.quantity)).toBe(1);
    expect(await prisma.sale.count({ where: { cashier_id: testCashierId } })).toBe(0);
    expect(await prisma.salePayment.count({ where: { sale: { cashier_id: testCashierId } } })).toBe(0);
    expect(await prisma.journalEntry.count({ where: { reference_type: 'SALE' } })).toBe(journalCountBeforeFailure);
    } finally {
      await prisma.sale.deleteMany({ where: { cashier_id: { in: [otherCashier.id, thirdCashier.id] } } });
      await prisma.inventoryTransaction.deleteMany({ where: { user_id: { in: [otherCashier.id, thirdCashier.id] } } });
      await prisma.user.deleteMany({ where: { id: { in: [otherCashier.id, thirdCashier.id] } } });
    }
  });

  it('filters sales history and daily store totals by branch', async () => {
    const storeOneProducts = await ProductsService.getProducts(undefined, undefined, testBranchId);
    const scopedProduct = storeOneProducts.find((product) => product.id === testProductId);
    expect(scopedProduct?.stock_balances).toHaveLength(1);
    expect(scopedProduct?.stock_balances[0].location_id).toBe(testBranchId);
    await SalesService.createSaleTransaction({
      branchId: testBranchId, channel: 'RETAIL', taxAmount: 0,
      items: [{ productId: testProductId, quantity: 1, unitPrice: 100 }], payments: [{ paymentMethod: 'CASH', amount: 100 }],
    }, testCashierId, { role: 'CASHIER', branchId: testBranchId });
    const otherCashier = await prisma.user.create({ data: { username: `branch2-${Date.now()}`, email: `branch2-${Date.now()}@example.com`, full_name: 'Branch 2 Cashier', password_hash: 'test', role_id: testRoleId, branch_id: otherBranchId } });
    try {
      await SalesService.createSaleTransaction({ branchId: otherBranchId, channel: 'RETAIL', taxAmount: 0,
        items: [{ productId: testProductId, quantity: 1, unitPrice: 100 }], payments: [{ paymentMethod: 'CASH', amount: 100 }],
      }, otherCashier.id, { role: 'CASHIER', branchId: otherBranchId });
      const storeOneSales = await SalesService.getSales(undefined, testBranchId);
      expect(storeOneSales).toHaveLength(1);
      expect(storeOneSales[0].branch_id).toBe(testBranchId);
      const summary = await StoreReportingService.getDailySummary(new Date(Date.now() - 60_000), new Date(Date.now() + 60_000));
      expect(summary.sales).toBe(200);
      expect(summary.orderCount).toBe(2);
      expect(summary.byStore.reduce((sum, row) => sum + row.sales, 0)).toBe(200);
    } finally {
      await prisma.sale.deleteMany({ where: { cashier_id: otherCashier.id } });
      await prisma.inventoryTransaction.deleteMany({ where: { user_id: otherCashier.id } });
      await prisma.user.delete({ where: { id: otherCashier.id } });
    }
  });
});
