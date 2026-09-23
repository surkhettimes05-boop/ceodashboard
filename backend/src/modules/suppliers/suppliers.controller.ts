import { Response } from 'express';
import { SuppliersService } from './suppliers.service.js';
import { createSupplierSchema, updateSupplierSchema } from './suppliers.schema.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';

export class SuppliersController {
  static async getSuppliers(req: AuthenticatedRequest, res: Response) {
    try {
      const suppliers = await SuppliersService.getSuppliers();
      return sendSuccess(res, suppliers, 'Suppliers retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve suppliers', 500);
    }
  }

  static async getSupplierById(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const supplier = await SuppliersService.getSupplierById(id);
      return sendSuccess(res, supplier, 'Supplier details');
    } catch (err: any) {
      return sendError(res, err.message || 'Supplier not found', 404);
    }
  }

  static async createSupplier(req: AuthenticatedRequest, res: Response) {
    try {
      const input = createSupplierSchema.parse(req.body);
      const newSupplier = await SuppliersService.createSupplier(input, req.user?.id);
      return sendSuccess(res, newSupplier, 'Supplier created successfully', 201);
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to create supplier', 400);
    }
  }

  static async updateSupplier(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const input = updateSupplierSchema.parse(req.body);
      const updated = await SuppliersService.updateSupplier(id, input, req.user?.id);
      return sendSuccess(res, updated, 'Supplier updated successfully');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to update supplier', 400);
    }
  }
}
