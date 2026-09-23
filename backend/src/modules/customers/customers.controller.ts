import { Response } from 'express';
import { CustomersService } from './customers.service.js';
import { createCustomerSchema, updateCustomerSchema } from './customers.schema.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { z } from 'zod';

export class CustomersController {
  static async getCustomers(req: AuthenticatedRequest, res: Response) {
    try {
      const isB2b = req.query.isB2b !== undefined ? req.query.isB2b === 'true' : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const customers = await CustomersService.getCustomers(isB2b, search);
      return sendSuccess(res, customers, 'Customers retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve customers', 500);
    }
  }

  static async getCustomerById(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const customer = await CustomersService.getCustomerById(id);
      return sendSuccess(res, customer, 'Customer details');
    } catch (err: any) {
      return sendError(res, err.message || 'Customer not found', 404);
    }
  }

  static async createCustomer(req: AuthenticatedRequest, res: Response) {
    try {
      const input = createCustomerSchema.parse(req.body);
      const newCustomer = await CustomersService.createCustomer(input, req.user?.id);
      return sendSuccess(res, newCustomer, 'Customer created successfully', 201);
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to create customer', 400);
    }
  }

  static async updateCustomer(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const input = updateCustomerSchema.parse(req.body);
      const updated = await CustomersService.updateCustomer(id, input, req.user?.id);
      return sendSuccess(res, updated, 'Customer updated successfully');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to update customer', 400);
    }
  }

  /**
   * Lookup customer by phone number (for POS)
   */
  static async lookupByPhone(req: AuthenticatedRequest, res: Response) {
    try {
      const { phone } = req.query;
      if (!phone || typeof phone !== 'string') {
        return sendError(res, 'Phone number is required', 400);
      }

      const customer = await CustomersService.lookupCustomerByPhone(phone);
      
      if (!customer) {
        return sendSuccess(res, null, 'Customer not found');
      }

      return sendSuccess(res, customer, 'Customer found');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to lookup customer', 500);
    }
  }

  /**
   * Get customer loyalty summary (for POS)
   */
  static async getLoyaltySummary(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const summary = await CustomersService.getCustomerLoyaltySummary(id);
      return sendSuccess(res, summary, 'Loyalty summary retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve loyalty summary', 404);
    }
  }

  /**
   * Fast customer creation for POS
   */
  static async createFromPOS(req: AuthenticatedRequest, res: Response) {
    try {
      const schema = z.object({
        phone: z.string().min(10, 'Phone number must be at least 10 digits'),
        name: z.string().min(2, 'Name is required'),
      });

      const input = schema.parse(req.body);
      const newCustomer = await CustomersService.createCustomerFromPOS(input.phone, input.name, req.user?.id);
      return sendSuccess(res, newCustomer, 'Customer created successfully', 201);
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to create customer', 400);
    }
  }
}
