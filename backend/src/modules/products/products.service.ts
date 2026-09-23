import { prisma } from '../../db/prisma.js';
import { CreateProductInput, UpdateProductInput } from './products.schema.js';
import { AuditService } from '../audit/audit.service.js';
import Decimal from 'decimal.js';

export class ProductsService {
  static async getProducts(search?: string, categoryId?: string) {
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (categoryId) {
      where.category_id = categoryId;
    }

    return prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true, abbreviation: true } },
        stock_balances: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  static async getProductById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        unit: true,
        stock_balances: true,
      },
    });
    if (!product) throw new Error('Product not found.');
    return product;
  }

  static async createProduct(input: CreateProductInput, actorUserId?: string) {
    const existingSku = await prisma.product.findUnique({ where: { sku: input.sku } });
    if (existingSku) throw new Error(`Product with SKU '${input.sku}' already exists.`);

    if (input.barcode) {
      const existingBarcode = await prisma.product.findUnique({ where: { barcode: input.barcode } });
      if (existingBarcode) throw new Error(`Product with Barcode '${input.barcode}' already exists.`);
    }

    const initialOpeningStock = Number(input.openingStock ?? 0);
    const defaultBranch = await prisma.branch.findFirst({
      where: { is_active: true },
      orderBy: { created_at: 'asc' },
    });

    const newProduct = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          sku: input.sku,
          barcode: input.barcode || null,
          name: input.name,
          category_id: input.categoryId,
          unit_id: input.unitId,
          cost_price: input.costPrice,
          selling_price: input.sellingPrice,
          wholesale_price: input.wholesalePrice || null,
          min_stock_level: input.minStockLevel ?? 5,
        },
        include: {
          category: true,
          unit: true,
        },
      });

      if (initialOpeningStock > 0 && defaultBranch && actorUserId) {
        const openingQty = new Decimal(initialOpeningStock);

        await tx.inventoryTransaction.create({
          data: {
            product_id: product.id,
            location_type: 'BRANCH',
            location_id: defaultBranch.id,
            movement_type: 'OPENING_STOCK',
            quantity: openingQty.toNumber(),
            unit_cost: new Decimal(input.costPrice).toNumber(),
            reference_type: 'PRODUCT',
            reference_id: product.id,
            user_id: actorUserId,
            notes: `Opening stock for ${product.name}`,
          },
        });

        await tx.stockBalance.upsert({
          where: {
            product_id_location_id: {
              product_id: product.id,
              location_id: defaultBranch.id,
            },
          },
          update: {
            quantity: openingQty.toNumber(),
          },
          create: {
            product_id: product.id,
            location_type: 'BRANCH',
            location_id: defaultBranch.id,
            quantity: openingQty.toNumber(),
          },
        });
      }

      return product;
    });

    await AuditService.log({
      userId: actorUserId,
      action: 'PRODUCT_CREATED',
      entity: 'Product',
      entityId: newProduct.id,
      newValues: { name: newProduct.name, sku: newProduct.sku, sellingPrice: input.sellingPrice, openingStock: initialOpeningStock },
    });

    return newProduct;
  }

  static async updateProduct(id: string, input: UpdateProductInput, actorUserId?: string) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new Error('Product not found.');

    const updated = await prisma.product.update({
      where: { id },
      data: {
        sku: input.sku ?? product.sku,
        barcode: input.barcode !== undefined ? input.barcode : product.barcode,
        name: input.name ?? product.name,
        category_id: input.categoryId ?? product.category_id,
        unit_id: input.unitId ?? product.unit_id,
        cost_price: input.costPrice !== undefined ? input.costPrice : product.cost_price,
        selling_price: input.sellingPrice !== undefined ? input.sellingPrice : product.selling_price,
        wholesale_price: input.wholesalePrice !== undefined ? input.wholesalePrice : product.wholesale_price,
        min_stock_level: input.minStockLevel !== undefined ? input.minStockLevel : product.min_stock_level,
        is_active: input.isActive !== undefined ? input.isActive : product.is_active,
      },
      include: {
        category: true,
        unit: true,
      },
    });

    await AuditService.log({
      userId: actorUserId,
      action: 'PRODUCT_UPDATED',
      entity: 'Product',
      entityId: id,
      oldValues: { name: product.name, sellingPrice: product.selling_price },
      newValues: { name: updated.name, sellingPrice: updated.selling_price },
    });

    return updated;
  }
}
