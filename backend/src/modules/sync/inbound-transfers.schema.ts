import { z } from 'zod';

export const inboundTransferSchema = z.object({
  eventId: z.string().trim().min(1).optional(),
  transferId: z.string().trim().min(1),
  transferNo: z.string().trim().min(1),
  destinationBranchCode: z.string().trim().min(1),
  eventType: z.string().trim().min(1).default('STOCK_TRANSFER'),
  occurredAt: z.coerce.date().default(() => new Date()),
  metadata: z.record(z.unknown()).optional(),
  items: z.array(z.object({
    productId: z.string().trim().min(1),
    quantity: z.number().finite().positive(),
  })).min(1),
  idempotencyKey: z.string().trim().min(1).optional(),
}).superRefine((input, ctx) => {
  if (!input.eventId && !input.idempotencyKey) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'eventId is required.' });
  }
});

export type InboundTransferInput = z.infer<typeof inboundTransferSchema> & { eventId: string };