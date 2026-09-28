import { PaymentMethod, SalesChannel } from '@prisma/client';
import Decimal from 'decimal.js';
import { prisma } from '../../db/prisma.js';
import { config } from '../../config/index.js';
import { SalesService } from '../sales/sales.service.js';
import { ReserveOnlineFulfillmentInput } from './online-fulfillment.schema.js';

export class OnlineFulfillmentError extends Error {
  constructor(message: string, public readonly statusCode = 400) {
    super(message);
    this.name = 'OnlineFulfillmentError';
  }
}

function canonicalItems(items: Array<{ productId: string; quantity: number }>) {
  return [...items]
    .map((item) => ({ productId: item.productId, quantity: Number(item.quantity) }))
    .sort((a, b) => a.productId.localeCompare(b.productId));
}

export class OnlineFulfillmentService {
  static async reserve(input: ReserveOnlineFulfillmentInput) {
    const requestedItems = canonicalItems(input.items);
    if (new Set(requestedItems.map((item) => item.productId)).size !== requestedItems.length) {
      throw new OnlineFulfillmentError('Each PASALO product may appear only once.', 422);
    }

    return prisma.$transaction(async (tx) => {
      const existing = await tx.onlineFulfillment.findUnique({
        where: { external_order_id: input.externalOrderId },
        include: {
          items: { include: { product: { select: { pasalo_product_id: true } } } },
          branch: { select: { code: true } },
        },
      });
      if (existing) {
        const existingItems = canonicalItems(existing.items.map((item) => ({
          productId: item.product.pasalo_product_id ?? item.product_id,
          quantity: Number(item.quantity),
        })));
        if (
          existing.pasalo_order_id !== input.pasaloOrderId ||
          existing.branch.code !== input.branchCode ||
          JSON.stringify(existingItems) !== JSON.stringify(requestedItems)
        ) {
          throw new OnlineFulfillmentError('Online fulfillment identity was reused with a different payload.', 409);
        }
        return { id: existing.id, status: existing.status, saleId: existing.sale_id, alreadyProcessed: true };
      }

      const branch = await tx.branch.findUnique({
        where: { code: input.branchCode },
        select: { id: true, code: true, is_active: true },
      });
      if (!branch || !branch.is_active) {
        throw new OnlineFulfillmentError(`Store '${input.branchCode}' is missing or inactive.`, 422);
      }
      if (config.nodeEnv === 'production' && !config.pasaloAllowedBranchCodes.includes(branch.code)) {
        throw new OnlineFulfillmentError(`Store '${input.branchCode}' is not authorized for PASALO online fulfillment.`, 403);
      }

      const mapped = [] as Array<{ productId: string; quantity: number }>;
      for (const item of requestedItems) {
        const product = await tx.product.findUnique({
          where: { pasalo_product_id: item.productId },
          select: { id: true, pasalo_product_id: true, is_active: true },
        });
        if (!product || !product.is_active || !product.pasalo_product_id) {
          throw new OnlineFulfillmentError(`PASALO product '${item.productId}' is not mapped to an active store product.`, 422);
        }

        const stock = await tx.$queryRaw<Array<{ quantity: Decimal | number | string }>>`
          SELECT COALESCE(quantity, 0) AS quantity
            FROM stock_balances
           WHERE product_id = ${product.id} AND location_id = ${branch.id}
           FOR UPDATE
        `;
        const reserved = await tx.$queryRaw<Array<{ quantity: Decimal | number | string }>>`
          SELECT COALESCE(SUM(i.quantity), 0) AS quantity
            FROM online_fulfillment_items i
            JOIN online_fulfillments f ON f.id = i.fulfillment_id
           WHERE f.branch_id = ${branch.id}
             AND f.status IN ('RESERVED', 'COMPLETING')
             AND i.product_id = ${product.id}
        `;
        const available = new Decimal(stock[0]?.quantity ?? 0).minus(reserved[0]?.quantity ?? 0);
        if (available.lessThan(item.quantity)) {
          throw new OnlineFulfillmentError(`Insufficient store stock for PASALO product '${item.productId}'.`, 409);
        }
        mapped.push({ productId: product.id, quantity: item.quantity });
      }

      const reservation = await tx.onlineFulfillment.create({
        data: {
          external_order_id: input.externalOrderId,
          pasalo_order_id: input.pasaloOrderId,
          branch_id: branch.id,
          customer_name: input.customerName,
          shipping_address: input.shippingAddress,
          items: {
            create: mapped.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
          },
        },
        include: { items: true },
      });
      return { id: reservation.id, status: reservation.status, saleId: null, alreadyProcessed: false };
    });
  }

  static async complete(externalOrderId: string) {
    const fulfillment = await prisma.onlineFulfillment.findUnique({
      where: { external_order_id: externalOrderId },
      include: {
        branch: { select: { id: true, code: true } },
        items: { include: { product: { select: { id: true, pasalo_product_id: true, selling_price: true } } } },
      },
    });
    if (!fulfillment) throw new OnlineFulfillmentError('Online fulfillment reservation not found.', 404);
    if (fulfillment.status === 'COMPLETED') return { id: fulfillment.id, status: fulfillment.status, saleId: fulfillment.sale_id, alreadyProcessed: true };
    if (fulfillment.status === 'CANCELLED') throw new OnlineFulfillmentError('Online fulfillment was cancelled.', 409);

    const claim = await prisma.onlineFulfillment.updateMany({
      where: { id: fulfillment.id, status: 'RESERVED' },
      data: { status: 'COMPLETING' },
    });
    if (claim.count === 0) {
      const current = await prisma.onlineFulfillment.findUnique({ where: { id: fulfillment.id } });
      if (current?.status === 'COMPLETED') return { id: current.id, status: current.status, saleId: current.sale_id, alreadyProcessed: true };
      if (current?.status === 'COMPLETING') return { id: current.id, status: current.status, saleId: current.sale_id, alreadyProcessed: false };
      if (current?.status === 'CANCELLED') throw new OnlineFulfillmentError('Online fulfillment was cancelled.', 409);
    }

    try {
      const actor = await prisma.user.findFirst({
        where: { is_active: true, role: { name: { in: ['CEO', 'ADMIN'] } } },
        select: { id: true },
      });
      if (!actor) throw new OnlineFulfillmentError('No active CEO or ADMIN user is available for online fulfillment.', 503);

      const items = fulfillment.items.map((item) => ({
        productId: item.product.id,
        quantity: Number(item.quantity),
        unitPrice: Number(item.product.selling_price),
      }));
      const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const saleKey = `online-fulfillment:${fulfillment.external_order_id}`;
      const priorSale = await prisma.idempotencyKey.findUnique({ where: { key: saleKey } });
      // The existing POS transaction is the only physical stock deduction.
      // Its idempotency key makes a completion retry reuse the same sale.
      const sale = priorSale?.status === 'PROCESSED' && priorSale.response_body
        ? priorSale.response_body
        : await SalesService.createSaleTransaction(
          {
            branchId: fulfillment.branch.id,
            customerId: null,
            loyaltyRedemptionPoints: 0,
            channel: SalesChannel.ONLINE,
            discountAmount: 0,
            taxAmount: 0,
            items,
            payments: [{ paymentMethod: PaymentMethod.CASH, amount: total, referenceCode: fulfillment.external_order_id }],
          },
          actor.id,
          { role: 'CEO', branchId: fulfillment.branch.id },
          saleKey,
        );
      const saleId = String((sale as { id: string }).id);
      const completed = await prisma.onlineFulfillment.update({
        where: { id: fulfillment.id },
        data: { status: 'COMPLETED', sale_id: saleId },
      });
      return { id: completed.id, status: completed.status, saleId: completed.sale_id, alreadyProcessed: false };
    } catch (error) {
      await prisma.onlineFulfillment.updateMany({
        where: { id: fulfillment.id, status: 'COMPLETING' },
        data: { status: 'RESERVED' },
      });
      throw error;
    }
  }

  static async cancel(externalOrderId: string) {
    return prisma.$transaction(async (tx) => {
      const fulfillment = await tx.onlineFulfillment.findUnique({ where: { external_order_id: externalOrderId } });
      if (!fulfillment) throw new OnlineFulfillmentError('Online fulfillment reservation not found.', 404);
      if (fulfillment.status === 'CANCELLED') return { id: fulfillment.id, status: fulfillment.status, alreadyProcessed: true };
      if (fulfillment.status === 'COMPLETED' || fulfillment.status === 'COMPLETING') {
        throw new OnlineFulfillmentError('Online fulfillment has already started and cannot be cancelled safely.', 409);
      }
      const cancelled = await tx.onlineFulfillment.update({ where: { id: fulfillment.id }, data: { status: 'CANCELLED' } });
      return { id: cancelled.id, status: cancelled.status, alreadyProcessed: false };
    });
  }
}
