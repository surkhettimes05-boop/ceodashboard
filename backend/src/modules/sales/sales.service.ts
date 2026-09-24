import { prisma } from "../../db/prisma.js";
import {
  SalesChannel,
  InventoryMovementType,
  PaymentMethod,
} from "@prisma/client";
import { CreateSaleInput } from "./sales.schema.js";
import { InventoryService } from "../inventory/inventory.service.js";
import { AccountingService } from "../accounting/accounting.service.js";
import { AuditService } from "../audit/audit.service.js";
import { LoyaltyService } from "../loyalty/loyalty.service.js";
import Decimal from "decimal.js";
import { createHash } from "node:crypto";

export class SalesService {
  static async getPaymentSummary(
    startDate: Date,
    endDate: Date,
    branchId?: string,
  ) {
    const sales = await prisma.sale.findMany({
      where: {
        status: "COMPLETED",
        created_at: { gte: startDate, lte: endDate },
        ...(branchId ? { branch_id: branchId } : {}),
      },
      select: {
        sale_payments: { select: { payment_method: true, amount: true } },
      },
    });

    const byMethod = Object.values(PaymentMethod).reduce<
      Record<string, { amount: number; transactionCount: number }>
    >((summary, method) => {
      summary[method] = { amount: 0, transactionCount: 0 };
      return summary;
    }, {});

    for (const sale of sales) {
      const countedMethods = new Set<PaymentMethod>();
      for (const payment of sale.sale_payments) {
        const method = byMethod[payment.payment_method];
        if (!method) continue;
        method.amount += Number(payment.amount);
        countedMethods.add(payment.payment_method);
      }
      for (const paymentMethod of countedMethods) {
        byMethod[paymentMethod].transactionCount += 1;
      }
    }

    const grandTotal = Object.values(byMethod).reduce(
      (total, method) => total + method.amount,
      0,
    );
    return {
      startDate,
      endDate,
      grandTotal,
      transactionCount: sales.length,
      byMethod,
    };
  }

  static async getSales(cashierId?: string, branchId?: string) {
    const where: any = {};
    if (cashierId) where.cashier_id = cashierId;
    if (branchId) where.branch_id = branchId;

    return prisma.sale.findMany({
      where,
      include: {
        branch: { select: { name: true, code: true } },
        cashier: { select: { username: true, full_name: true } },
        customer: { select: { name: true, code: true } },
        sale_items: {
          include: { product: { select: { sku: true, name: true } } },
        },
        sale_payments: true,
      },
      orderBy: { created_at: "desc" },
    });
  }

  static async getSaleById(id: string) {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        branch: true,
        cashier: true,
        customer: true,
        sale_items: { include: { product: true } },
        sale_payments: true,
      },
    });

    if (!sale) throw new Error("Sale transaction not found.");
    return sale;
  }

  /**
   * CORE ATOMIC SALES ENGINE: Executes Sale + Inventory Deduction + Payments + GL Entries in ONE Transaction
   */
  static async createSaleTransaction(
    input: CreateSaleInput,
    cashierId: string,
    actor?: { role?: string; branchId?: string | null },
    idempotencyKey?: string,
  ) {
    const saleNumber = `SAL-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const requestHash = idempotencyKey
      ? createHash("sha256").update(JSON.stringify(input)).digest("hex")
      : undefined;

    try {
      return await prisma.$transaction(async (tx) => {
        if (idempotencyKey && requestHash) {
          const existing = await tx.idempotencyKey.findUnique({
            where: { key: idempotencyKey },
          });
          if (existing) {
            if (
              existing.endpoint !== "POST /sales" ||
              existing.request_hash !== requestHash
            ) {
              const error: any = new Error(
                "Idempotency-Key was already used with a different request.",
              );
              error.statusCode = 409;
              throw error;
            }
            if (existing.status === "PROCESSED" && existing.response_body) {
              return existing.response_body;
            }
            const error: any = new Error(
              "A request with this idempotency key is already in progress.",
            );
            error.statusCode = 409;
            throw error;
          }
          await tx.idempotencyKey.create({
            data: {
              key: idempotencyKey,
              endpoint: "POST /sales",
              request_hash: requestHash,
              status: "PROCESSING",
              expires_at: new Date("9999-12-31T23:59:59.999Z"),
            },
          });
        }
        const branch = await tx.branch.findUnique({
          where: { id: input.branchId },
        });
        if (!branch) throw new Error("Branch location not found.");
        if (
          actor?.role === "CASHIER" &&
          (!actor.branchId || actor.branchId !== input.branchId)
        ) {
          throw new Error(
            "Cashier can only create sales for their assigned branch.",
          );
        }

        if (
          input.payments.some(
            (payment) => payment.paymentMethod === PaymentMethod.CREDIT,
          ) &&
          !input.customerId
        ) {
          throw new Error(
            "A registered customer is required for store credit sales.",
          );
        }

        // 1. Calculate items subtotals and COGS
        let subtotal = new Decimal(0);
        let totalCogs = new Decimal(0);

        const itemsWithCost = [];

        for (const item of input.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });
          if (!product || !product.is_active) {
            throw new Error(`Product ${item.productId} not found or inactive.`);
          }

          const itemQty = new Decimal(item.quantity);
          const itemPrice = new Decimal(product.selling_price);
          const itemCost = new Decimal(product.cost_price);

          const itemSubtotal = itemQty.times(itemPrice);
          const itemTotalCost = itemQty.times(itemCost);

          subtotal = subtotal.plus(itemSubtotal);
          totalCogs = totalCogs.plus(itemTotalCost);

          itemsWithCost.push({
            productId: item.productId,
            quantity: itemQty,
            unitPrice: itemPrice,
            unitCost: itemCost,
            subtotal: itemSubtotal,
          });
        }

        let discount = new Decimal(input.discountAmount || 0);
        if (discount.greaterThan(subtotal)) {
          throw new Error("Discount cannot exceed the sale subtotal.");
        }
        const redemptionPoints = input.loyaltyRedemptionPoints || 0;
        let redemptionDiscount = new Decimal(0);
        if (redemptionPoints > 0) {
          if (!input.customerId)
            throw new Error(
              "A registered customer is required to redeem loyalty points.",
            );
          const loyaltySettings = await LoyaltyService.getSettings(tx);
          const customer = await tx.customer.findUnique({
            where: { id: input.customerId },
            select: { loyalty_points_balance: true },
          });
          if (!customer) throw new Error("Customer not found");
          if (redemptionPoints < loyaltySettings.minimumRedeemPoints)
            throw new Error(
              `Minimum redemption is ${loyaltySettings.minimumRedeemPoints} points`,
            );
          if (Number(customer.loyalty_points_balance) < redemptionPoints)
            throw new Error("Insufficient points balance");
          redemptionDiscount = new Decimal(redemptionPoints).times(
            loyaltySettings.pointsValue,
          );
          discount = discount.plus(redemptionDiscount);
        }
        const tax = new Decimal(0);
        const totalAmount = subtotal.minus(discount).plus(tax);
        if (!totalAmount.greaterThan(0)) {
          throw new Error("Sale total must be greater than zero.");
        }

        const creditAmount = input.payments
          .filter((payment) => payment.paymentMethod === PaymentMethod.CREDIT)
          .reduce(
            (amount, payment) => amount.plus(new Decimal(payment.amount)),
            new Decimal(0),
          );
        if (creditAmount.greaterThan(0)) {
          if (!input.customerId) {
            throw new Error(
              "A registered customer is required for store credit sales.",
            );
          }
          const customer = await tx.customer.findUnique({
            where: { id: input.customerId },
          });
          if (!customer) throw new Error("Customer not found");
        }

        // 2. Validate Payment Total Matches Sale Total
        let totalPaid = new Decimal(0);
        for (const pay of input.payments) {
          totalPaid = totalPaid.plus(new Decimal(pay.amount));
        }

        if (!totalPaid.equals(totalAmount)) {
          throw new Error(
            `Payment mismatch! Total payments ($${totalPaid.toString()}) must equal final total ($${totalAmount.toString()})`,
          );
        }

        // 3. Create Sale Record
        const sale = await tx.sale.create({
          data: {
            sale_number: saleNumber,
            branch_id: input.branchId,
            cashier_id: cashierId,
            customer_id: input.customerId || null,
            channel: input.channel || SalesChannel.RETAIL,
            subtotal: subtotal.toNumber(),
            discount_amount: discount.toNumber(),
            tax_amount: tax.toNumber(),
            total_amount: totalAmount.toNumber(),
            sale_items: {
              create: itemsWithCost.map((i) => ({
                product_id: i.productId,
                quantity: i.quantity.toNumber(),
                unit_price: i.unitPrice.toNumber(),
                unit_cost: i.unitCost.toNumber(),
                subtotal: i.subtotal.toNumber(),
              })),
            },
            sale_payments: {
              create: input.payments.map((p) => ({
                payment_method: p.paymentMethod,
                amount: new Decimal(p.amount).toNumber(),
                reference_code: p.referenceCode || null,
              })),
            },
          },
          include: {
            sale_items: {
              include: { product: { select: { name: true, sku: true } } },
            },
            sale_payments: true,
          },
        });

        if (creditAmount.greaterThan(0)) {
          await tx.customer.update({
            where: { id: input.customerId! },
            data: {
              outstanding_balance: { increment: creditAmount.toNumber() },
            },
          });
        }

        // 4. Deduct Inventory Stock Balances (SALE movement)
        for (const item of itemsWithCost) {
          await InventoryService.recordMovementTx(tx, {
            productId: item.productId,
            locationType: "BRANCH",
            locationId: input.branchId,
            movementType: InventoryMovementType.SALE,
            quantity: -item.quantity.toNumber(),
            unitCost: item.unitCost.toNumber(),
            referenceType: "SALE",
            referenceId: sale.id,
            userId: cashierId,
            notes: `POS Sale ${saleNumber}`,
          });
        }

        // 5. Post Double-Entry Accounting Journal Entries
        const journalLines = [];

        // Debits for Payments
        for (const pay of input.payments) {
          const accountCode = AccountingService.resolvePaymentAccountCode(
            pay.paymentMethod,
          );

          journalLines.push({
            accountCode,
            debit: pay.amount,
            credit: 0,
          });
        }

        // Debit COGS & Credit Inventory Asset
        if (totalCogs.greaterThan(0)) {
          journalLines.push({
            accountCode: "5010",
            debit: totalCogs.toNumber(),
            credit: 0,
          }); // Debit COGS
          journalLines.push({
            accountCode: "1040",
            debit: 0,
            credit: totalCogs.toNumber(),
          }); // Credit Inventory Asset
        }

        // Credit Revenue
        const revenueAccountCode = AccountingService.resolveRevenueAccountCode(
          String(input.channel || SalesChannel.RETAIL),
        );
        journalLines.push({
          accountCode: revenueAccountCode,
          debit: 0,
          credit: totalAmount.toNumber(),
        });

        await AccountingService.postJournalEntryTx(tx, {
          referenceType: "SALE",
          referenceId: sale.id,
          description: `GL Entry for POS Sale ${saleNumber}`,
          userId: cashierId,
          lines: journalLines,
        });

        // 6. Record Audit Log
        await AuditService.log(
          {
            userId: cashierId,
            action: "SALE_CREATED",
            entity: "Sale",
            entityId: sale.id,
            newValues: {
              saleNumber,
              totalAmount: totalAmount.toNumber(),
              channel: input.channel,
            },
          },
          tx,
        );

        // 7. Award loyalty points if customer is linked
        let loyaltyInfo: any = null;
        if (input.customerId) {
          const customerBeforeLoyalty = await tx.customer.findUnique({
            where: { id: input.customerId },
            select: { loyalty_points_balance: true },
          });
          if (!customerBeforeLoyalty) throw new Error("Customer not found");
          const previousBalance = Number(
            customerBeforeLoyalty.loyalty_points_balance,
          );
          if (redemptionPoints > 0) {
            await LoyaltyService.redeemPointsInTransaction(
              tx,
              input.customerId,
              redemptionPoints,
              `Points redeemed for sale ${saleNumber}`,
              cashierId,
              sale.id,
            );
          }
          const points = await LoyaltyService.calculatePoints(
            totalAmount.toNumber(),
            tx,
          );
          if (points > 0) {
            await LoyaltyService.awardPoints(
              input.customerId,
              sale.id,
              points,
              `Points earned from sale ${saleNumber}`,
              cashierId,
              tx,
            );
          }

          // Update customer loyalty stats
          await LoyaltyService.updateCustomerStats(
            input.customerId,
            totalAmount.toNumber(),
            cashierId,
            tx,
          );

          // Get loyalty summary for receipt
          const loyaltyBalance = await LoyaltyService.getLoyaltyBalance(
            input.customerId,
            tx,
          );
          loyaltyInfo = {
            pointsEarned: points,
            pointsRedeemed: redemptionPoints,
            previousBalance,
            currentBalance: loyaltyBalance,
            newBalance: loyaltyBalance,
          };
        }

        // Return sale with loyalty info
        const response = {
          ...sale,
          loyaltyInfo,
        };
        if (idempotencyKey) {
          await tx.idempotencyKey.update({
            where: { key: idempotencyKey },
            data: { status: "PROCESSED", response_body: response as any },
          });
        }
        return response;
      });
    } catch (error: any) {
      if (idempotencyKey && error?.code === "P2002") {
        const existing = await prisma.idempotencyKey.findUnique({
          where: { key: idempotencyKey },
        });
        if (
          existing?.endpoint === "POST /sales" &&
          existing.request_hash === requestHash &&
          existing.status === "PROCESSED" &&
          existing.response_body
        ) {
          return existing.response_body;
        }
        const conflict: any = new Error(
          "Idempotency-Key was already used with a different request or is in progress.",
        );
        conflict.statusCode = 409;
        throw conflict;
      }
      throw error;
    }
  }

  /**
   * Void a sale (same-day void with full reversal)
   * Reverses inventory deduction and accounting journal entry
   */
  static async voidSale(saleId: string, userId: string, reason: string) {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { sale_items: true, sale_payments: true },
    });

    if (!sale) throw new Error("Sale not found.");
    if (sale.status !== "COMPLETED")
      throw new Error("Only COMPLETED sales can be voided.");

    // Check if sale is from same day (business rule for voids)
    const saleDate = new Date(sale.created_at);
    const today = new Date();
    const isSameDay = saleDate.toDateString() === today.toDateString();

    if (!isSameDay) {
      throw new Error(
        "Only same-day sales can be voided. Use return/refund for older sales.",
      );
    }

    return prisma.$transaction(async (tx) => {
      // 1. Restore inventory stock (reverse the SALE movement)
      for (const item of sale.sale_items) {
        await InventoryService.recordMovementTx(tx, {
          productId: item.product_id,
          locationType: "BRANCH",
          locationId: sale.branch_id,
          movementType: InventoryMovementType.RETURN,
          quantity: item.quantity,
          unitCost: item.unit_cost,
          referenceType: "SALE_VOID",
          referenceId: sale.id,
          userId,
          notes: `Inventory restoration for voided sale ${sale.sale_number}`,
        });
      }

      // 2. Find and reverse the original journal entry
      const journalEntry = await tx.journalEntry.findFirst({
        where: {
          reference_type: "SALE",
          reference_id: sale.id,
          status: "POSTED",
        },
        include: { ledger_entries: true },
      });

      if (journalEntry) {
        await AccountingService.reverseJournalEntryTx(
          tx,
          journalEntry.id,
          userId,
          `Void of sale ${sale.sale_number}: ${reason}`,
        );
      }

      // 3. Update sale status to VOIDED
      const voidedSale = await tx.sale.update({
        where: { id: saleId },
        data: {
          status: "VOIDED",
          voided_by: userId,
          voided_at: new Date(),
          void_reason: reason,
        },
      });

      // 4. Reverse loyalty points if customer was linked
      if (sale.customer_id) {
        await LoyaltyService.reversePoints(sale.id, userId);
      }

      // 5. Record audit log
      await AuditService.log({
        userId,
        action: "SALE_VOIDED",
        entity: "Sale",
        entityId: saleId,
        oldValues: { saleNumber: sale.sale_number, status: "COMPLETED" },
        newValues: { saleNumber: sale.sale_number, status: "VOIDED", reason },
      });

      return voidedSale;
    });
  }
}
