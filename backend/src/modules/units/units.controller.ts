import { Response } from 'express';
import { UnitsService } from './units.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';

export class UnitsController {
  static async getUnits(req: AuthenticatedRequest, res: Response) {
    try {
      const units = await UnitsService.getUnits();
      return sendSuccess(res, units, 'Units retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve units', 500);
    }
  }

  static async createUnit(req: AuthenticatedRequest, res: Response) {
    try {
      const newUnit = await UnitsService.createUnit(req.body);
      return sendSuccess(res, newUnit, 'Unit created', 201);
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to create unit', 400);
    }
  }
}
