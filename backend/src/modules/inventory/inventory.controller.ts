import { Response } from 'express';
import { InventoryService } from './inventory.service.js';
import { stockAdjustmentSchema, createTransferSchema, receiveTransferSchema } from './inventory.schema.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';

export class InventoryController {
  static async getBalances(req: AuthenticatedRequest, res: Response) {
    try {
      const locationId = req.query.locationId as string;
      const balances = await InventoryService.getStockBalances(locationId);
      return sendSuccess(res, balances, 'Stock balances retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve stock balances', 500);
    }
  }

  static async getTransactions(req: AuthenticatedRequest, res: Response) {
    try {
      const productId = req.query.productId as string;
      const locationId = req.query.locationId as string;
      const logs = await InventoryService.getInventoryTransactions(productId, locationId);
      return sendSuccess(res, logs, 'Inventory transactions audit log');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve audit log', 500);
    }
  }

  static async createAdjustment(req: AuthenticatedRequest, res: Response) {
    try {
      const input = stockAdjustmentSchema.parse(req.body);
      const userId = req.user?.id || 'system';
      const result = await InventoryService.createStockAdjustment(input, userId);
      return sendSuccess(res, result, 'Stock adjustment processed successfully', 201);
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to process stock adjustment', 400);
    }
  }

  static async createTransfer(req: AuthenticatedRequest, res: Response) {
    try {
      const input = createTransferSchema.parse(req.body);
      const userId = req.user?.id || 'system';
      const transfer = await InventoryService.createStockTransfer(input, userId);
      return sendSuccess(res, transfer, 'Stock transfer initiated', 201);
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to initiate transfer', 400);
    }
  }

  static async receiveTransfer(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const input = receiveTransferSchema.parse(req.body);
      const idempotencyKey = req.get('Idempotency-Key');
      if (!idempotencyKey) {
        return sendError(res, 'Idempotency-Key header is required for transfer receiving', 400);
      }
      const userId = req.user?.id || 'system';
      const transfer = await InventoryService.receiveStockTransfer(
        id,
        input,
        userId,
        req.user?.branchId,
        idempotencyKey,
      );
      return sendSuccess(res, transfer, 'Stock transfer received and posted');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to receive transfer', err.statusCode || (err.name === 'ZodError' ? 400 : 400), err.issues);
    }
  }

  static async getTransfers(req: AuthenticatedRequest, res: Response) {
    try {
      const transfers = await InventoryService.getStockTransfers();
      return sendSuccess(res, transfers, 'Stock transfers retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve transfers', 500);
    }
  }

  static async getLowStockAlerts(req: AuthenticatedRequest, res: Response) {
    try {
      const alerts = await InventoryService.getLowStockAlerts();
      return sendSuccess(res, alerts, 'Low stock alerts');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve low stock alerts', 500);
    }
  }
}
