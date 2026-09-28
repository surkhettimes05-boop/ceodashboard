import { z } from 'zod';

const itemSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.number().finite().positive(),
});

export const reserveOnlineFulfillmentSchema = z.object({
  externalOrderId: z.string().trim().min(1),
  pasaloOrderId: z.string().trim().min(1),
  branchCode: z.string().trim().min(1),
  customerName: z.string().trim().min(1).optional(),
  shippingAddress: z.string().trim().min(1).optional(),
  items: z.array(itemSchema).min(1),
});

export type ReserveOnlineFulfillmentInput = z.infer<typeof reserveOnlineFulfillmentSchema>;
