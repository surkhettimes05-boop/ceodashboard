import { z } from 'zod';

const FEEDBACK_CATEGORIES = [
  'Product Availability',
  'Quality',
  'Price',
  'Staff',
  'Checkout',
  'Cleanliness',
  'Delivery',
  'Other',
] as const;

export const submitFeedbackSchema = z.object({
  token: z.string().min(1, 'Feedback token is required'),
  rating: z.number().int().min(1).max(5, 'Rating must be between 1 and 5'),
  category: z.enum(FEEDBACK_CATEGORIES, { required_error: 'Category is required' }),
  comment: z.string().optional(),
  photoUrl: z.string().url('Invalid photo URL').optional().or(z.literal('')),
});

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;
