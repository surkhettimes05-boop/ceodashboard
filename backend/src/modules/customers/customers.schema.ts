import { z } from 'zod';

export const createCustomerSchema = z.object({
  code: z.string().min(2, 'Customer code is required'),
  name: z.string().min(2, 'Customer name is required'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  isB2b: z.boolean().optional().default(false),
  creditLimit: z.number().min(0).optional().default(0),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
