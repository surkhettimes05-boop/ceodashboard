import { z } from 'zod';

export const createPurchaseSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  items: z.array(
    z.object({
      productId: z.string().min(1, 'Product is required'),
      quantity: z.number().gt(0, 'Quantity must be greater than 0'),
      unitCost: z.number().min(0, 'Unit cost must be non-negative'),
    })
  ).min(1, 'At least one item is required'),
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
