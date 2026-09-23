import { prisma } from '../../db/prisma.js';
import { InventoryMovementType } from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service.js';
import { AccountingService } from '../accounting/accounting.service.js';
import { AuditService } from '../audit/audit.service.js';
import Decimal from 'decimal.js';
import { CreateReturnInput } from './sales.schema.js';

export class SalesReturnsService {
  static async getReturns() {
    return prisma.saleReturn.findMany({
      include: {
        sale: { select: { sale_number: true } },
        branch: { select: { name: true, code: true } },
        return_items: {
          include: { product: { select: { sku: true, name: true } } },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  static async getReturnById(id: string) {
    const returnRecord = await prisma.saleReturn.findUnique({
      where: { id },
      include: {
        sale: true,
        branch: true,
        return_items: { include: { product: true } },
      },
    });

    if (!returnRecord) throw new Error('Return record not found.');
    return returnRecord;
  }

  /**
   * Process a sales return with inventory restocking and accounting reversal
   */
  static async createReturn(input: CreateReturnInput, userId: string) {
    const returnNumber = `RET-${Date.now().toString().slice(-6)}`;

    return prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: input.saleId },
        include: { sale_items: true, returns: { include: { return_items: true } } },
      });

      if (!sale) throw new Error('Original sale not found.');
      if (sale.status !== 'COMPLETED') throw new Error('Only completed sales can be returned.');
      if (sale.branch_id !== input.branchId) throw new Error('Return branch must match the original sale branch.');

      let totalRefundAmount = new Decimal(0);
      const returnItemsData = [];
      let returnedSaleValue = new Decimal(0);

      // Validate and calculate return amounts
      for (const item of input.items) {
        const originalSaleItem = sale.sale_items.find((si) => si.product_id === item.productId);
        if (!originalSaleItem) {
          throw new Error(`Product ${item.productId} not found in original sale.`);
        }

        const returnQty = new Decimal(item.quantity);
        const originalQty = new Decimal(originalSaleItem.quantity);
        const alreadyReturnedQty = sale.returns.reduce((total, previousReturn) => total.plus(
          previousReturn.return_items
            .filter((previousItem) => previousItem.product_id === item.productId)
            .reduce((itemTotal, previousItem) => itemTotal.plus(new Decimal(previousItem.quantity)), new Decimal(0))
        ), new Decimal(0));
        
        if (returnQty.plus(alreadyReturnedQty).greaterThan(originalQty)) {
          throw new Error(`Return quantity exceeds the remaining quantity for product ${item.productId}.`);
        }

        const refundAmount = returnQty.times(new Decimal(originalSaleItem.unit_price));
        totalRefundAmount = totalRefundAmount.plus(refundAmount);
        returnedSaleValue = returnedSaleValue.plus(refundAmount);

        returnItemsData.push({
          product_id: item.productId,
          quantity: returnQty.toNumber(),
          unit_price: originalSaleItem.unit_price,
          refund_amount: refundAmount.toNumber(),
        });
      }

      if (!returnedSaleValue.equals(new Decimal(sale.total_amount))) {
        throw new Error('Partial returns are not enabled until proportional accounting reversals are implemented. Return the complete sale instead.');
      }

      // Create return record
      const returnRecord = await tx.saleReturn.create({
        data: {
          return_number: returnNumber,
          sale_id: input.saleId,
          branch_id: input.branchId,
          customer_id: input.customerId || sale.customer_id,
          total_amount: sale.total_amount,
          refund_amount: totalRefundAmount.toNumber(),
          reason: input.reason,
          created_by: userId,
          return_items: {
            create: returnItemsData,
          },
        },
        include: { return_items: true },
      });

      // Restock inventory (RETURN movement)
      for (const item of returnRecord.return_items) {
        await InventoryService.recordMovementTx(tx, {
          productId: item.product_id,
          locationType: 'BRANCH',
          locationId: input.branchId,
          movementType: InventoryMovementType.RETURN,
          quantity: item.quantity,
          unitCost: sale.sale_items.find((saleItem) => saleItem.product_id === item.product_id)!.unit_cost,
          referenceType: 'SALE_RETURN',
          referenceId: returnRecord.id,
          userId,
          notes: `Restocking for return ${returnNumber}`,
        });
      }

      // Reverse the original journal entry (partial or full)
      const journalEntry = await tx.journalEntry.findFirst({
        where: {
          reference_type: 'SALE',
          reference_id: sale.id,
          status: 'POSTED',
        },
        include: { ledger_entries: true },
      });

      if (journalEntry) {
        await AccountingService.reverseJournalEntryTx(tx, journalEntry.id, userId, `Return of sale ${sale.sale_number}: ${input.reason}`);
      }

      // Record audit log
      await AuditService.log({
        userId,
        action: 'SALE_RETURN_CREATED',
        entity: 'SaleReturn',
        entityId: returnRecord.id,
        newValues: { returnNumber, refundAmount: totalRefundAmount.toNumber(), reason: input.reason },
      });

      return returnRecord;
    });
  }
}
