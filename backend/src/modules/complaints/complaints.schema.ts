import { z } from 'zod';

const COMPLAINT_CATEGORIES = [
  'Product Quality',
  'Service Quality',
  'Staff Behavior',
  'Pricing',
  'Delivery',
  'Store Environment',
  'Payment Issues',
  'Other',
] as const;

const COMPLAINT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const COMPLAINT_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

export const createComplaintSchema = z.object({
  customerId: z.string().nullable(),
  transactionId: z.string().nullable(),
  storeId: z.string().min(1, 'Store ID is required'),
  category: z.enum(COMPLAINT_CATEGORIES, { required_error: 'Category is required' }),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  priority: z.enum(COMPLAINT_PRIORITIES).default('MEDIUM'),
});

export const updateComplaintStatusSchema = z.object({
  status: z.enum(COMPLAINT_STATUSES, { required_error: 'Status is required' }),
});

export const assignComplaintSchema = z.object({
  assignedTo: z.string().min(1, 'Assigned user ID is required'),
});

export const addResolutionSchema = z.object({
  resolution: z.string().min(10, 'Resolution must be at least 10 characters'),
});

export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;
export type UpdateComplaintStatusInput = z.infer<typeof updateComplaintStatusSchema>;
export type AssignComplaintInput = z.infer<typeof assignComplaintSchema>;
export type AddResolutionInput = z.infer<typeof addResolutionSchema>;
