import { Response } from 'express';
import { LoyaltyService } from './loyalty.service.js';
import { redeemPointsSchema, adjustPointsSchema, updateSettingsSchema } from './loyalty.schema.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';

export class LoyaltyController {
  static async previewPoints(req: AuthenticatedRequest, res: Response) {
    try {
      const amount = Number(req.query.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        return sendError(res, 'A valid sale amount is required', 400);
      }
      return sendSuccess(res, await LoyaltyService.previewPoints(amount), 'Loyalty points preview calculated');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to calculate loyalty preview', 500);
    }
  }

  static async getSettings(req: AuthenticatedRequest, res: Response) {
    try {
      const settings = await LoyaltyService.getSettings();
      return sendSuccess(res, settings, 'Loyalty settings retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve loyalty settings', 500);
    }
  }

  static async updateSettings(req: AuthenticatedRequest, res: Response) {
    try {
      const input = updateSettingsSchema.parse(req.body);
      return sendSuccess(res, await LoyaltyService.updateSettings(input), 'Loyalty settings updated');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to update settings', 400);
    }
  }

  static async getLoyaltyLedger(req: AuthenticatedRequest, res: Response) {
    try {
      const customerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const ledger = await LoyaltyService.getLoyaltyLedger(customerId);
      return sendSuccess(res, ledger, 'Loyalty ledger retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve loyalty ledger', 500);
    }
  }

  static async getLoyaltyBalance(req: AuthenticatedRequest, res: Response) {
    try {
      const customerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const balance = await LoyaltyService.getLoyaltyBalance(customerId);
      return sendSuccess(res, { balance }, 'Loyalty balance retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve loyalty balance', 500);
    }
  }

  static async redeemPoints(req: AuthenticatedRequest, res: Response) {
    try {
      const input = redeemPointsSchema.parse(req.body);
      await LoyaltyService.redeemPoints(input.customerId, input.points, input.description, req.user?.id);
      return sendSuccess(res, null, 'Points redeemed successfully');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to redeem points', 400);
    }
  }

  static async adjustPoints(req: AuthenticatedRequest, res: Response) {
    try {
      const input = adjustPointsSchema.parse(req.body);
      await LoyaltyService.adjustPoints(input.customerId, input.points, input.reason, req.user?.id);
      return sendSuccess(res, null, 'Points adjusted successfully');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to adjust points', 400);
    }
  }
}
