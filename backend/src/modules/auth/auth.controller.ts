import { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { loginSchema, refreshTokenSchema } from './auth.schema.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const input = loginSchema.parse(req.body);
      const result = await AuthService.login(input, req.ip);
      return sendSuccess(res, result, 'Login successful');
    } catch (err: any) {
      return sendError(res, err.message || 'Login failed', 400);
    }
  }

  static async refresh(req: Request, res: Response) {
    try {
      const input = refreshTokenSchema.parse(req.body);
      const tokens = await AuthService.refresh(input.refreshToken);
      return sendSuccess(res, tokens, 'Token refreshed successfully');
    } catch (err: any) {
      return sendError(res, err.message || 'Token refresh failed', 401);
    }
  }

  static async me(req: AuthenticatedRequest, res: Response) {
    return sendSuccess(res, req.user, 'Current user profile');
  }

  static async logout(req: AuthenticatedRequest, res: Response) {
    return sendSuccess(res, null, 'Logged out successfully');
  }
}
