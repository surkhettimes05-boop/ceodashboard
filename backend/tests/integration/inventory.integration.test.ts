import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../src/db/prisma.js';
import { InventoryService } from '../../src/modules/inventory/inventory.service.js';

describe('Inventory Integration Tests', () => {
  let testProductId: string;
  let testBranchId: string;
  let testWarehouseId: string;
  let testUserId: string;
  const testSuffix = Date.now();
  const testBranchCode = `TEST-BRANCH-${testSuffix}`;
  const testWarehouseCode = `TEST-WAREHOUSE-${testSuffix}`;
  const testCategoryName = `Test Category ${testSuffix}`;
  const testUnitName = `Piece ${testSuffix}`;
  const testUsername = `testuser-${testSuffix}`;

  beforeAll(async () => {
    // Setup test data
    const branch = await prisma.branch.create({
      data: {
        code: testBranchCode,
        name: 'Test Branch',
      },
    });
    testBranchId = branch.id;

    const warehouse = await prisma.warehouse.create({
      data: {
        code: testWarehouseCode,
        name: 'Test Warehouse',
        branch_id: testBranchId,
      },
    });
    testWarehouseId = warehouse.id;

    const category = await prisma.category.create({
      data: {
        name: testCategoryName,
      },
    });

    const unit = await prisma.unit.create({
      data: {
        name: testUnitName,
        abbreviation: 'pc',
      },
    });

    const product = await prisma.product.create({
      data: {
        sku: `TEST-${testSuffix}`,
        name: 'Test Product',
        category_id: category.id,
        unit_id: unit.id,
        cost_price: 10.00,
        selling_price: 15.00,
        min_stock_level: 5,
      },
    });
    testProductId = product.id;

    const role = await prisma.role.create({
      data: {
        name: 'MANAGER',
        description: 'Test Manager Role',
      },
    });

    const user = await prisma.user.create({
      data: {
        username: testUsername,
        email: `${testUsername}@example.com`,
        password_hash: 'hashedpassword',
        full_name: 'Test User',
        role_id: role.id,
        branch_id: testBranchId,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.inventoryTransaction.deleteMany({});
    await prisma.stockBalance.deleteMany({});
    await prisma.stockTransferItem.deleteMany({});
    await prisma.user.deleteMany({ where: { username: testUsername } });
    await prisma.product.deleteMany({ where: { sku: `TEST-${testSuffix}` } });
    await prisma.warehouse.deleteMany({ where: { code: testWarehouseCode } });
    await prisma.branch.deleteMany({ where: { code: testBranchCode } });
    await prisma.category.deleteMany({ where: { name: testCategoryName } });
    await prisma.unit.deleteMany({ where: { name: testUnitName } });
    await prisma.role.deleteMany({ where: { name: 'MANAGER' } });
  });

  beforeEach(async () => {
    // Clear inventory transactions and stock balances before each test
    await prisma.inventoryTransaction.deleteMany({});
    await prisma.stockBalance.deleteMany({});
  });

  describe('Stock Adjustments', () => {
    it('should add stock to a location', async () => {
      await prisma.$transaction(async (tx) => {
        await InventoryService.recordMovementTx(tx, {
          productId: testProductId,
          locationType: 'WAREHOUSE',
          locationId: testWarehouseId,
          quantity: 100,
          movementType: 'ADJUSTMENT',
          unitCost: 10.00,
          referenceType: 'TEST',
          referenceId: 'TEST-001',
          userId: testUserId,
        });
      });

      const balance = await prisma.stockBalance.findUnique({
        where: {
          product_id_location_id: {
            product_id: testProductId,
            location_id: testWarehouseId,
          },
        },
      });

      expect(balance).not.toBeNull();
      expect(Number(balance?.quantity)).toBe(100);
    });

    it('should prevent negative stock for SALE movement', async () => {
      // First add stock
      await prisma.$transaction(async (tx) => {
        await InventoryService.recordMovementTx(tx, {
          productId: testProductId,
          locationType: 'WAREHOUSE',
          locationId: testWarehouseId,
          quantity: 10,
          movementType: 'ADJUSTMENT',
          unitCost: 10.00,
          referenceType: 'TEST',
          referenceId: 'TEST-001',
          userId: testUserId,
        });
      });

      // Try to sell more than available
      await expect(
        prisma.$transaction(async (tx) => {
          await InventoryService.recordMovementTx(tx, {
            productId: testProductId,
            locationType: 'WAREHOUSE',
            locationId: testWarehouseId,
            quantity: -20,
            movementType: 'SALE',
            unitCost: 10.00,
            referenceType: 'TEST',
            referenceId: 'TEST-002',
            userId: testUserId,
          });
        })
      ).rejects.toThrow('Insufficient stock');
    });

    it('should reject negative stock because the database constraint forbids it', async () => {
      await expect(prisma.$transaction(async (tx) => {
        await InventoryService.recordMovementTx(tx, {
          productId: testProductId,
          locationType: 'WAREHOUSE',
          locationId: testWarehouseId,
          quantity: -50,
          movementType: 'ADJUSTMENT',
          unitCost: 10.00,
          referenceType: 'TEST',
          referenceId: 'TEST-001',
          userId: testUserId,
        });
      })).rejects.toThrow();
    });
  });

  describe('Stock Transfers', () => {
    it('should transfer stock between locations', async () => {
      // Add stock to source
      await prisma.$transaction(async (tx) => {
        await InventoryService.recordMovementTx(tx, {
          productId: testProductId,
          locationType: 'WAREHOUSE',
          locationId: testWarehouseId,
          quantity: 100,
          movementType: 'ADJUSTMENT',
          unitCost: 10.00,
          referenceType: 'TEST',
          referenceId: 'TEST-001',
          userId: testUserId,
        });
      });

      // Create transfer
      const transfer = await InventoryService.createStockTransfer({
        sourceLocationId: testWarehouseId,
        destinationLocationId: testBranchId,
        notes: 'Integration test transfer',
        items: [{ productId: testProductId, quantity: 50 }],
      }, testUserId);
      await InventoryService.receiveStockTransfer(transfer.id, testUserId);

      // Verify source balance
      const sourceBalance = await prisma.stockBalance.findUnique({
        where: {
          product_id_location_id: {
            product_id: testProductId,
            location_id: testWarehouseId,
          },
        },
      });

      // Verify destination balance
      const destBalance = await prisma.stockBalance.findUnique({
        where: {
          product_id_location_id: {
            product_id: testProductId,
            location_id: testBranchId,
          },
        },
      });

      expect(Number(sourceBalance?.quantity)).toBe(50);
      expect(Number(destBalance?.quantity)).toBe(50);
    });
  });

  describe('Inventory Transactions', () => {
    it('should create immutable transaction records', async () => {
      await prisma.$transaction(async (tx) => {
        await InventoryService.recordMovementTx(tx, {
          productId: testProductId,
          locationType: 'WAREHOUSE',
          locationId: testWarehouseId,
          quantity: 100,
          movementType: 'ADJUSTMENT',
          unitCost: 10.00,
          referenceType: 'TEST',
          referenceId: 'TEST-001',
          userId: testUserId,
        });
      });

      const transactions = await prisma.inventoryTransaction.findMany({
        where: { product_id: testProductId },
      });

      expect(transactions).toHaveLength(1);
      expect(Number(transactions[0].quantity)).toBe(100);
      expect(transactions[0].movement_type).toBe('ADJUSTMENT');
    });
  });
});
