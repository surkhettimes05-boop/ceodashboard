import { prisma } from '../../db/prisma.js';
import { InventoryMovementType, TransferStatus } from '@prisma/client';
import { StockAdjustmentInput, CreateTransferInput } from './inventory.schema.js';
import { AuditService } from '../audit/audit.service.js';
import Decimal from 'decimal.js';

export interface RecordMovementParams {
  productId: string;
  locationType: 'WAREHOUSE' | 'BRANCH';
  locationId: string;
  movementType: InventoryMovementType;
  quantity: number | Decimal;
  unitCost: number | Decimal;
  referenceType: string;
  referenceId: string;
  userId: string;
  notes?: string;
}

export class InventoryService {
  static calculateInventoryValue(items: Array<{ quantity: number | Decimal; unitCost: number | Decimal }>): number {
    let total = new Decimal(0);

    for (const item of items) {
      const qty = new Decimal(item.quantity);
      const unitCost = new Decimal(item.unitCost);
      total = total.plus(qty.times(unitCost));
    }

    return total.toNumber();
  }

  /**
   * Core Transaction Engine: Records an immutable Stock Ledger entry and updates real-time Stock Balance
   */
  static async recordMovementTx(tx: any, params: RecordMovementParams) {
    const qty = new Decimal(params.quantity);
    const cost = new Decimal(params.unitCost);

    const productRows = await tx.$queryRaw<{ id: string; name: string; sku: string }[]>`SELECT id, name, sku FROM products WHERE id = ${params.productId} FOR UPDATE`;
    const product = productRows[0];

    const existingBalanceRows = await tx.$queryRaw<{ quantity: number }[]>`SELECT quantity FROM stock_balances WHERE product_id = ${params.productId} AND location_id = ${params.locationId} FOR UPDATE`;
    const currentQty = existingBalanceRows.length > 0 ? new Decimal(existingBalanceRows[0].quantity) : new Decimal(0);
    const newQty = currentQty.plus(qty);

    if (newQty.isNegative() && (params.movementType === 'SALE' || params.movementType === 'TRANSFER_OUT')) {
      throw new Error(`Insufficient stock for ${product?.name || 'product'}${product?.sku ? ` (${product.sku})` : ''}. Current stock: ${currentQty.toString()}, Requested deduction: ${qty.abs().toString()}`);
    }

    // 1. Create immutable transaction log
    const invTx = await tx.inventoryTransaction.create({
      data: {
        product_id: params.productId,
        location_type: params.locationType,
        location_id: params.locationId,
        movement_type: params.movementType,
        quantity: qty.toNumber(),
        unit_cost: cost.toNumber(),
        reference_type: params.referenceType,
        reference_id: params.referenceId,
        user_id: params.userId,
        notes: params.notes || null,
      },
    });

    // 2. Upsert real-time StockBalance for location

    const updatedBalance = await tx.stockBalance.upsert({
      where: {
        product_id_location_id: {
          product_id: params.productId,
          location_id: params.locationId,
        },
      },
      update: {
        quantity: newQty.toNumber(),
      },
      create: {
        product_id: params.productId,
        location_type: params.locationType,
        location_id: params.locationId,
        quantity: newQty.toNumber(),
      },
    });

    return { invTx, updatedBalance };
  }

  static async getStockBalances(locationId?: string) {
    const where: any = {};
    if (locationId) {
      where.location_id = locationId;
    }

    const balances = await prisma.stockBalance.findMany({
      where,
      include: {
        product: {
          include: {
            category: { select: { name: true } },
            unit: { select: { abbreviation: true } },
          },
        },
      },
      orderBy: { product: { name: 'asc' } },
    });

    return balances.map((b) => ({
      ...b,
      is_low_stock: new Decimal(b.quantity).lessThanOrEqualTo(b.product.min_stock_level),
    }));
  }

  static async getInventoryTransactions(productId?: string, locationId?: string) {
    const where: any = {};
    if (productId) where.product_id = productId;
    if (locationId) where.location_id = locationId;

    return prisma.inventoryTransaction.findMany({
      where,
      include: {
        product: { select: { sku: true, name: true } },
        user: { select: { username: true, full_name: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
  }

  static async createStockAdjustment(input: StockAdjustmentInput, userId: string) {
    const product = await prisma.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new Error('Product not found.');

    const unitCost = input.unitCost !== undefined ? input.unitCost : Number(product.cost_price);

    const result = await prisma.$transaction(async (tx) => {
      return this.recordMovementTx(tx, {
        productId: input.productId,
        locationType: input.locationType,
        locationId: input.locationId,
        movementType: input.movementType,
        quantity: input.quantity,
        unitCost,
        referenceType: 'ADJUSTMENT',
        referenceId: `ADJ-${Date.now()}`,
        userId,
        notes: input.notes,
      });
    });

    await AuditService.log({
      userId,
      action: 'STOCK_ADJUSTED',
      entity: 'InventoryTransaction',
      entityId: result.invTx.id,
      newValues: { productId: input.productId, qty: input.quantity, type: input.movementType },
    });

    return result;
  }

  static async createStockTransfer(input: CreateTransferInput, userId: string) {
    if (input.sourceLocationId === input.destinationLocationId) {
      throw new Error('Source and destination locations must be different.');
    }

    const transferNumber = `TR-${Date.now().toString().slice(-6)}`;

    return prisma.$transaction(async (tx) => {
      // Create Transfer Record
      const transfer = await tx.stockTransfer.create({
        data: {
          transfer_number: transferNumber,
          source_location_id: input.sourceLocationId,
          destination_location_id: input.destinationLocationId,
          status: TransferStatus.IN_TRANSIT,
          notes: input.notes || null,
          created_by: userId,
          items: {
            create: input.items.map((item) => ({
              product_id: item.productId,
              quantity: item.quantity,
            })),
          },
        },
        include: { items: true },
      });

      // Deduct stock from Source Location (TRANSFER_OUT)
      for (const item of input.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) throw new Error(`Product ${item.productId} not found`);

        await this.recordMovementTx(tx, {
          productId: item.productId,
          locationType: 'WAREHOUSE',
          locationId: input.sourceLocationId,
          movementType: InventoryMovementType.TRANSFER_OUT,
          quantity: -Math.abs(item.quantity),
          unitCost: product.cost_price,
          referenceType: 'TRANSFER',
          referenceId: transfer.id,
          userId,
          notes: `Transfer Out to ${input.destinationLocationId}`,
        });
      }

      await AuditService.log({
        userId,
        action: 'STOCK_TRANSFERRED',
        entity: 'StockTransfer',
        entityId: transfer.id,
        newValues: { transferNumber, itemCount: input.items.length },
      });

      return transfer;
    });
  }

  static async receiveStockTransfer(transferId: string, userId: string) {
    const transfer = await prisma.stockTransfer.findUnique({
      where: { id: transferId },
      include: { items: true },
    });

    if (!transfer) throw new Error('Transfer record not found.');
    if (transfer.status !== TransferStatus.IN_TRANSIT) {
      throw new Error(`Transfer cannot be received. Current status is ${transfer.status}`);
    }

    return prisma.$transaction(async (tx) => {
      // Add stock to Destination Location (TRANSFER_IN)
      for (const item of transfer.items) {
        const product = await tx.product.findUnique({ where: { id: item.product_id } });
        const unitCost = product ? product.cost_price : 0;

        await this.recordMovementTx(tx, {
          productId: item.product_id,
          locationType: 'BRANCH',
          locationId: transfer.destination_location_id,
          movementType: InventoryMovementType.TRANSFER_IN,
          quantity: Math.abs(Number(item.quantity)),
          unitCost,
          referenceType: 'TRANSFER',
          referenceId: transfer.id,
          userId,
          notes: `Transfer In from ${transfer.source_location_id}`,
        });
      }

      // Update Transfer status to COMPLETED
      const updatedTransfer = await tx.stockTransfer.update({
        where: { id: transferId },
        data: { status: TransferStatus.COMPLETED },
      });

      await AuditService.log({
        userId,
        action: 'STOCK_TRANSFER_RECEIVED',
        entity: 'StockTransfer',
        entityId: transferId,
      });

      return updatedTransfer;
    });
  }

  static async getLowStockAlerts() {
    const balances = await prisma.stockBalance.findMany({
      include: {
        product: {
          include: { category: true, unit: true },
        },
      },
    });

    return balances.filter(
      (b) => new Decimal(b.quantity).lessThanOrEqualTo(b.product.min_stock_level)
    );
  }

  static async getStockTransfers() {
    return prisma.stockTransfer.findMany({
      include: {
        items: {
          include: { product: { select: { sku: true, name: true } } },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }
}
