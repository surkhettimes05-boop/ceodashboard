import { z } from 'zod';
import { SalesChannel, PaymentMethod } from '@prisma/client';

export const createSaleSchema = z.object({
  branchId: z.string().min(1, 'Branch is required'),
  customerId: z.string().optional().nullable(),
  loyaltyRedemptionPoints: z.number().int().min(0, 'Loyalty redemption points cannot be negative').optional().default(0),
  channel: z.nativeEnum(SalesChannel).optional().default(SalesChannel.RETAIL),
  discountAmount: z.number().min(0).optional().default(0),
  taxAmount: z.literal(0).optional().default(0),
  items: z.array(
    z.object({
      productId: z.string().min(1, 'Product ID is required'),
      quantity: z.number().gt(0, 'Quantity must be greater than 0'),
      unitPrice: z.number().min(0, 'Unit price must be non-negative'),
    })
  ).min(1, 'At least one item is required for a sale'),
  payments: z.array(
    z.object({
      paymentMethod: z.nativeEnum(PaymentMethod),
      amount: z.number().gt(0, 'Payment amount must be greater than 0'),
      referenceCode: z.string().optional(),
    })
  ).min(1, 'At least one payment method is required'),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const createReturnSchema = z.object({
  saleId: z.string().min(1, 'Sale is required'),
  branchId: z.string().min(1, 'Branch is required'),
  customerId: z.string().optional().nullable(),
  items: z.array(z.object({
    productId: z.string().min(1, 'Product is required'),
    quantity: z.number().gt(0, 'Return quantity must be greater than 0'),
  })).min(1, 'At least one return item is required'),
  reason: z.string().trim().min(1, 'Return reason is required'),
});

export type CreateReturnInput = z.infer<typeof createReturnSchema>;
