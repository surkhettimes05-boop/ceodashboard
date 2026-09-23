import { Response } from 'express';
import { RolesService } from './roles.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';

export class RolesController {
  static async getRoles(req: AuthenticatedRequest, res: Response) {
    try {
      const roles = await RolesService.getRoles();
      return sendSuccess(res, roles, 'Roles retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve roles', 500);
    }
  }

  static async getPermissions(req: AuthenticatedRequest, res: Response) {
    try {
      const permissions = await RolesService.getPermissions();
      return sendSuccess(res, permissions, 'Permissions retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve permissions', 500);
    }
  }
}
