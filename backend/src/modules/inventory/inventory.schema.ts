import { z } from 'zod';
import { InventoryMovementType } from '@prisma/client';

export const stockAdjustmentSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  locationType: z.enum(['WAREHOUSE', 'BRANCH']),
  locationId: z.string().min(1, 'Location is required'),
  quantity: z.number(), // Positive to add, negative to reduce
  movementType: z.enum(['ADJUSTMENT', 'DAMAGE', 'OPENING_STOCK']),
  unitCost: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export const createTransferSchema = z.object({
  sourceLocationId: z.string().min(1, 'Source location is required'),
  destinationLocationId: z.string().min(1, 'Destination location is required'),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().gt(0, 'Quantity must be greater than 0'),
    })
  ).min(1, 'At least one item is required for transfer'),
});

export const receiveTransferSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().finite().positive('Received quantity must be greater than 0'),
  })).min(1).optional(),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type ReceiveTransferInput = z.infer<typeof receiveTransferSchema>;
