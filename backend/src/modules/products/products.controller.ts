import { Response } from 'express';
import { ProductsService } from './products.service.js';
import { createProductSchema, linkPasaloProductSchema, updateProductSchema } from './products.schema.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';

export class ProductsController {
  static async getProducts(req: AuthenticatedRequest, res: Response) {
    try {
      const search = req.query.search as string;
      const categoryId = req.query.categoryId as string;
      const products = await ProductsService.getProducts(search, categoryId);
      return sendSuccess(res, products, 'Products retrieved');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to retrieve products', 500);
    }
  }

  static async getProductById(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const product = await ProductsService.getProductById(id);
      return sendSuccess(res, product, 'Product details');
    } catch (err: any) {
      return sendError(res, err.message || 'Product not found', 404);
    }
  }

  static async createProduct(req: AuthenticatedRequest, res: Response) {
    try {
      const input = createProductSchema.parse(req.body);
      const newProduct = await ProductsService.createProduct(input, req.user?.id);
      return sendSuccess(res, newProduct, 'Product created successfully', 201);
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to create product', 400);
    }
  }

  static async updateProduct(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const input = updateProductSchema.parse(req.body);
      const updated = await ProductsService.updateProduct(id, input, req.user?.id);
      return sendSuccess(res, updated, 'Product updated successfully');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to update product', 400);
    }
  }

  static async linkPasaloProduct(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { pasaloProductId } = linkPasaloProductSchema.parse(req.body);
      const product = await ProductsService.linkPasaloProduct(id, pasaloProductId, req.user?.id);
      return sendSuccess(res, product, 'Product linked to PASALO successfully');
    } catch (err: any) {
      return sendError(res, err.message || 'Failed to link product to PASALO', 400);
    }
  }
}
