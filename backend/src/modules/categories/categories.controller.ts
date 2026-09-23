import { Response } from 'express';
import { CategoriesService } from './categories.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';

export class CategoriesController {
  static async getCategories(req: AuthenticatedRequest, res: Response) {
    try {
      const categories = await CategoriesService.getCategories();
      return sendSuccess(res, categories, 'Categories retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve categories', 500);
    }
  }

  static async createCategory(req: AuthenticatedRequest, res: Response) {
    try {
      const newCategory = await CategoriesService.createCategory(req.body);
      return sendSuccess(res, newCategory, 'Category created', 201);
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to create category', 400);
    }
  }
}
