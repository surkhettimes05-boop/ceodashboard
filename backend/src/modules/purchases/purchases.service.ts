import { prisma } from '../../db/prisma.js';
import { PurchaseStatus, InventoryMovementType } from '@prisma/client';
import { CreatePurchaseInput } from './purchases.schema.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { AccountingService } from '../accounting/accounting.service.js';
import { AuditService } from '../audit/audit.service.js';
import Decimal from 'decimal.js';

export class PurchasesService {
  static async getPurchases() {
    return prisma.purchase.findMany({
      include: {
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        purchase_items: {
          include: { product: { select: { sku: true, name: true } } },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  static async getPurchaseById(id: string) {
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        warehouse: true,
        purchase_items: {
          include: { product: true },
        },
      },
    });

    if (!purchase) throw new Error('Purchase order not found.');
    return purchase;
  }

  static async createPurchase(input: CreatePurchaseInput, userId: string) {
    const supplier = await prisma.supplier.findUnique({ where: { id: input.supplierId } });
    if (!supplier) throw new Error('Supplier not found.');

    const warehouse = await prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
    if (!warehouse) throw new Error('Warehouse not found.');

    const poNumber = `PO-${Date.now().toString().slice(-6)}`;

    // Calculate total amount
    let totalAmount = new Decimal(0);
    const itemData = input.items.map((item) => {
      const subtotal = new Decimal(item.quantity).times(item.unitCost);
      totalAmount = totalAmount.plus(subtotal);
      return {
        product_id: item.productId,
        quantity: item.quantity,
        unit_cost: item.unitCost,
        subtotal: subtotal.toNumber(),
      };
    });

    const newPurchase = await prisma.purchase.create({
      data: {
        purchase_number: poNumber,
        supplier_id: input.supplierId,
        warehouse_id: input.warehouseId,
        status: PurchaseStatus.ORDERED,
        total_amount: totalAmount.toNumber(),
        created_by: userId,
        purchase_items: {
          create: itemData,
        },
      },
      include: {
        purchase_items: true,
        supplier: true,
        warehouse: true,
      },
    });

    await AuditService.log({
      userId,
      action: 'PURCHASE_ORDER_CREATED',
      entity: 'Purchase',
      entityId: newPurchase.id,
      newValues: { poNumber, totalAmount: totalAmount.toNumber() },
    });

    return newPurchase;
  }

  /**
   * Goods Receipt Note (GRN) Receiving: Updates PO to RECEIVED and posts stock intake to Warehouse Stock Balances
   */
  static async receivePurchase(purchaseId: string, userId: string) {
    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { purchase_items: true },
    });

    if (!purchase) throw new Error('Purchase order not found.');
    if (purchase.status !== PurchaseStatus.ORDERED) {
      throw new Error(`Purchase order cannot be received. Current status is ${purchase.status}`);
    }

    return prisma.$transaction(async (tx) => {
      let totalInventoryReceived = new Decimal(0);

      // 1. Post stock intake movements to Inventory Ledger for each line item
      for (const item of purchase.purchase_items) {
        totalInventoryReceived = totalInventoryReceived.plus(new Decimal(item.unit_cost).times(new Decimal(item.quantity)));

        await InventoryService.recordMovementTx(tx, {
          productId: item.product_id,
          locationType: 'WAREHOUSE',
          locationId: purchase.warehouse_id,
          movementType: InventoryMovementType.PURCHASE,
          quantity: item.quantity,
          unitCost: item.unit_cost,
          referenceType: 'PURCHASE_RECEIPT',
          referenceId: purchase.id,
          userId,
          notes: `GRN Intake for PO ${purchase.purchase_number}`,
        });
      }

      // 2. Post the purchase as a GL Journal Entry: Dr Inventory, Cr Accounts Payable
      await AccountingService.postJournalEntryTx(tx, {
        referenceType: 'PURCHASE',
        referenceId: purchase.id,
        description: `Inventory receipt for PO ${purchase.purchase_number}`,
        userId,
        lines: [
          { accountCode: '1040', debit: totalInventoryReceived.toNumber(), credit: 0 },
          { accountCode: '2010', debit: 0, credit: totalInventoryReceived.toNumber() },
        ],
      });

      // 3. Mark Purchase Order status as RECEIVED
      const updatedPurchase = await tx.purchase.update({
        where: { id: purchaseId },
        data: { status: PurchaseStatus.RECEIVED },
        include: { supplier: true, warehouse: true, purchase_items: true },
      });

      await AuditService.log({
        userId,
        action: 'PURCHASE_RECEIPT_POSTED',
        entity: 'Purchase',
        entityId: purchaseId,
        newValues: { poNumber: purchase.purchase_number, status: 'RECEIVED' },
      });

      return updatedPurchase;
    });
  }
}
