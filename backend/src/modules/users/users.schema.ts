import { z } from 'zod';
import { RoleType } from '@prisma/client';

export const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(1, 'Full name is required'),
  roleName: z.nativeEnum(RoleType),
  branchId: z.string().optional().nullable(),
});

export const updateUserSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  fullName: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
  roleName: z.nativeEnum(RoleType).optional(),
  branchId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
