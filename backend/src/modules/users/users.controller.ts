import { Response } from 'express';
import { UsersService } from './users.service.js';
import { createUserSchema, updateUserSchema } from './users.schema.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';

export class UsersController {
  static async getUsers(req: AuthenticatedRequest, res: Response) {
    try {
      const users = await UsersService.getUsers();
      return sendSuccess(res, users, 'Users retrieved successfully');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve users', 500);
    }
  }

  static async getUserById(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const user = await UsersService.getUserById(id);
      return sendSuccess(res, user, 'User details retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve user', 404);
    }
  }

  static async createUser(req: AuthenticatedRequest, res: Response) {
    try {
      const input = createUserSchema.parse(req.body);
      const newUser = await UsersService.createUser(input, req.user?.id);
      return sendSuccess(res, newUser, 'User created successfully', 201);
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to create user', 400);
    }
  }

  static async updateUser(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const input = updateUserSchema.parse(req.body);
      const updated = await UsersService.updateUser(id, input, req.user?.id);
      return sendSuccess(res, updated, 'User updated successfully');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to update user', 400);
    }
  }
}
