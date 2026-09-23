import { z } from 'zod';

export const createProductSchema = z.object({
  sku: z.string().min(2, 'SKU is required'),
  barcode: z.string().optional().nullable(),
  name: z.string().min(2, 'Product name is required'),
  categoryId: z.string().min(1, 'Category is required'),
  unitId: z.string().min(1, 'Unit of measure is required'),
  costPrice: z.number().min(0, 'Cost price must be non-negative'),
  sellingPrice: z.number().min(0, 'Selling price must be non-negative'),
  wholesalePrice: z.number().min(0).optional().nullable(),
  minStockLevel: z.number().min(0).optional().default(5),
  openingStock: z.number().min(0).optional().default(0),
});

export const updateProductSchema = createProductSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
