import { Response } from 'express';
import { PurchasesService } from './purchases.service.js';
import { createPurchaseSchema } from './purchases.schema.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';

export class PurchasesController {
  static async getPurchases(req: AuthenticatedRequest, res: Response) {
    try {
      const purchases = await PurchasesService.getPurchases();
      return sendSuccess(res, purchases, 'Purchase orders retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve purchase orders', 500);
    }
  }

  static async getPurchaseById(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const purchase = await PurchasesService.getPurchaseById(id);
      return sendSuccess(res, purchase, 'Purchase order details');
    } catch (err: any) {
      return sendError(res, err.message || 'Purchase order not found', 404);
    }
  }

  static async createPurchase(req: AuthenticatedRequest, res: Response) {
    try {
      const input = createPurchaseSchema.parse(req.body);
      const userId = req.user?.id || 'system';
      const purchase = await PurchasesService.createPurchase(input, userId);
      return sendSuccess(res, purchase, 'Purchase order created', 201);
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to create purchase order', 400);
    }
  }

  static async receivePurchase(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const userId = req.user?.id || 'system';
      const purchase = await PurchasesService.receivePurchase(id, userId);
      return sendSuccess(res, purchase, 'Goods Receipt (GRN) received and posted to inventory');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to receive purchase order', 400);
    }
  }
}
