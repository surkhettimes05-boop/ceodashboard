import { Response } from 'express';
import { WarehousesService } from './warehouses.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';

export class WarehousesController {
  static async getWarehouses(req: AuthenticatedRequest, res: Response) {
    try {
      const warehouses = await WarehousesService.getWarehouses();
      return sendSuccess(res, warehouses, 'Warehouses retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve warehouses', 500);
    }
  }

  static async createWarehouse(req: AuthenticatedRequest, res: Response) {
    try {
      const newWarehouse = await WarehousesService.createWarehouse(req.body);
      return sendSuccess(res, newWarehouse, 'Warehouse created', 201);
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to create warehouse', 400);
    }
  }
}
