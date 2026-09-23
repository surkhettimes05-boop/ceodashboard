import { Response } from 'express';
import { ComplaintsService } from './complaints.service.js';
import {
  createComplaintSchema,
  updateComplaintStatusSchema,
  assignComplaintSchema,
  addResolutionSchema,
} from './complaints.schema.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';

export class ComplaintsController {
  static async createComplaint(req: AuthenticatedRequest, res: Response) {
    try {
      const input = createComplaintSchema.parse(req.body);
      const complaint = await ComplaintsService.createComplaint(
        input.customerId ?? null,
        input.transactionId ?? null,
        input.storeId,
        input.category,
        input.description,
        input.priority,
        req.user?.id
      );
      return sendSuccess(res, complaint, 'Complaint created successfully', 201);
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to create complaint', 400);
    }
  }

  static async getComplaints(req: AuthenticatedRequest, res: Response) {
    try {
      const storeId = req.query.storeId as string | undefined;
      const status = req.query.status as string | undefined;
      const complaints = await ComplaintsService.getComplaints(storeId, status, req.user?.id);
      return sendSuccess(res, complaints, 'Complaints retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve complaints', 500);
    }
  }

  static async getComplaint(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const complaint = await ComplaintsService.getComplaint(id);
      return sendSuccess(res, complaint, 'Complaint retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve complaint', 404);
    }
  }

  static async assignComplaint(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const input = assignComplaintSchema.parse(req.body);
      const complaint = await ComplaintsService.assignComplaint(id, input.assignedTo, req.user?.id);
      return sendSuccess(res, complaint, 'Complaint assigned successfully');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to assign complaint', 400);
    }
  }

  static async updateStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const input = updateComplaintStatusSchema.parse(req.body);
      const complaint = await ComplaintsService.updateStatus(id, input.status, req.user?.id);
      return sendSuccess(res, complaint, 'Complaint status updated successfully');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to update complaint status', 400);
    }
  }

  static async addResolution(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const input = addResolutionSchema.parse(req.body);
      const complaint = await ComplaintsService.addResolution(id, input.resolution, req.user?.id);
      return sendSuccess(res, complaint, 'Resolution added successfully');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to add resolution', 400);
    }
  }

  static async closeComplaint(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const complaint = await ComplaintsService.closeComplaint(id, req.user?.id);
      return sendSuccess(res, complaint, 'Complaint closed successfully');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to close complaint', 400);
    }
  }

  static async getComplaintStats(req: AuthenticatedRequest, res: Response) {
    try {
      const storeId = req.query.storeId as string | undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const stats = await ComplaintsService.getComplaintStats(storeId, startDate, endDate);
      return sendSuccess(res, stats, 'Complaint statistics retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve complaint statistics', 500);
    }
  }
}
