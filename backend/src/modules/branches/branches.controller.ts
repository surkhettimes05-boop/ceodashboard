import { Response } from 'express';
import { BranchesService } from './branches.service.js';
import { createBranchSchema, updateBranchSchema } from './branches.schema.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';

export class BranchesController {
  static async getBranches(req: AuthenticatedRequest, res: Response) {
    try {
      const branches = await BranchesService.getBranches();
      return sendSuccess(res, branches, 'Branches retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve branches', 500);
    }
  }

  static async getBranchById(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const branch = await BranchesService.getBranchById(id);
      return sendSuccess(res, branch, 'Branch details');
    } catch (err: any) {
      return sendError(res, err.message || 'Branch not found', 404);
    }
  }

  static async createBranch(req: AuthenticatedRequest, res: Response) {
    try {
      const input = createBranchSchema.parse(req.body);
      const newBranch = await BranchesService.createBranch(input, req.user?.id);
      return sendSuccess(res, newBranch, 'Branch created', 201);
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to create branch', 400);
    }
  }

  static async updateBranch(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const input = updateBranchSchema.parse(req.body);
      const updated = await BranchesService.updateBranch(id, input, req.user?.id);
      return sendSuccess(res, updated, 'Branch updated');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to update branch', 400);
    }
  }
}
