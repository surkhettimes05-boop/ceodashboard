import { z } from 'zod';

export const createBranchSchema = z.object({
  code: z.string().min(2, 'Branch code is required'),
  name: z.string().min(2, 'Branch name is required'),
  address: z.string().optional(),
  phone: z.string().optional(),
});

export const updateBranchSchema = createBranchSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
