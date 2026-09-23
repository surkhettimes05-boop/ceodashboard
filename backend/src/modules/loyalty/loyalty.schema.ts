import { z } from 'zod';

export const redeemPointsSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  points: z.number().int().positive('Points must be positive'),
  description: z.string().min(1, 'Description is required'),
});

export const adjustPointsSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  points: z.number({ message: 'Points must be a number' }),
  reason: z.string().min(1, 'Reason is required'),
});

export const updateSettingsSchema = z.object({
  pointsPerCurrency: z.number().positive().optional(),
  currencyPerPoint: z.number().positive().optional(),
  minimumRedeemPoints: z.number().int().positive().optional(),
  pointsValue: z.number().positive().optional(),
  active: z.boolean().optional(),
});

export type RedeemPointsInput = z.infer<typeof redeemPointsSchema>;
export type AdjustPointsInput = z.infer<typeof adjustPointsSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
