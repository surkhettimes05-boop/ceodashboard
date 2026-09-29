import { prisma } from '../../db/prisma.js';
import { CreateProductInput, UpdateProductInput } from './products.schema.js';
import { AuditService } from '../audit/audit.service.js';
import Decimal from 'decimal.js';

export class ProductsService {
  static async syncPasaloCatalog() {
    const catalogUrl = process.env.PASALO_CATALOG_API_URL?.replace(/\/$/, '');
    const apiKey = process.env.PASALO_CATALOG_API_KEY;
    if (!catalogUrl || !apiKey) throw new Error('PASALO catalog synchronization is not configured.');

    const products: Array<Record<string, any>> = [];
    let page = 1;
    let total = Number.POSITIVE_INFINITY;
    while (products.length < total) {
      const url = new URL(catalogUrl);
      url.searchParams.set('page', String(page));
      url.searchParams.set('limit', '200');
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`PASALO catalog request failed (${response.status}).`);
      const payload = await response.json() as any;
      const result = payload?.data?.items ? payload.data : payload?.items ? payload : null;
      if (!result || !Array.isArray(result.items) || !Number.isFinite(Number(result.total))) {
        throw new Error('PASALO returned an invalid catalog response.');
      }
      products.push(...result.items);
      total = Number(result.total);
      if (!result.items.length || products.length >= total) break;
      page += 1;
    }

    return prisma.$transaction(async (tx) => {
      let linked = 0;
      let updated = 0;
      const unmatched: string[] = [];
      for (const item of products) {
        const pasaloProductId = String(item.id ?? '');
        const sku = String(item.skuCode ?? '').trim();
        if (!pasaloProductId || !sku || !String(item.name ?? '').trim()) {
          throw new Error('PASALO catalog contains a product without ID, SKU, or name.');
        }
        const [mapped, skuMatch] = await Promise.all([
          tx.product.findUnique({ where: { pasalo_product_id: pasaloProductId } }),
          tx.product.findUnique({ where: { sku } }),
        ]);
        if (mapped && skuMatch && mapped.id !== skuMatch.id) {
          throw new Error(`PASALO SKU ${sku} conflicts with an existing product mapping.`);
        }
        const target = mapped ?? skuMatch;
        if (target?.pasalo_product_id && target.pasalo_product_id !== pasaloProductId) {
          throw new Error(`SKU ${sku} is already mapped to a different PASALO product.`);
        }
        const categoryName = item.category && typeof item.category === 'object' ? String(item.category.name ?? '') : '';
        const unitName = item.defaultUnit && typeof item.defaultUnit === 'object' ? String(item.defaultUnit.name ?? '') : '';
        const unitSymbol = item.defaultUnit && typeof item.defaultUnit === 'object' ? String(item.defaultUnit.symbol ?? '') : '';
        const [existingCategory, existingUnit] = await Promise.all([
          categoryName ? tx.category.findFirst({ where: { name: { equals: categoryName, mode: 'insensitive' } } }) : null,
          unitName || unitSymbol ? tx.unit.findFirst({ where: { OR: [
            ...(unitName ? [{ name: { equals: unitName, mode: 'insensitive' as const } }] : []),
            ...(unitSymbol ? [{ abbreviation: { equals: unitSymbol, mode: 'insensitive' as const } }] : []),
          ] } }) : null,
        ]);
        const category = existingCategory ?? (categoryName ? await tx.category.upsert({ where: { name: categoryName }, create: { name: categoryName }, update: {} }) : null);
        const unit = existingUnit ?? (unitName ? await tx.unit.upsert({ where: { name: unitName }, create: { name: unitName, abbreviation: unitSymbol || unitName }, update: unitSymbol ? { abbreviation: unitSymbol } : {} }) : null);
        if (target) {
          await tx.product.update({
            where: { id: target.id },
            data: {
              pasalo_product_id: pasaloProductId,
              sku,
              barcode: item.barcode ? String(item.barcode) : null,
              name: String(item.name).trim(),
              ...(category ? { category_id: category.id } : {}),
              ...(unit ? { unit_id: unit.id } : {}),
              is_active: item.isActive !== false,
            },
          });
          if (mapped) updated += 1;
          else linked += 1;
        } else {
          const costPrice = item.costPrice == null ? null : Number(item.costPrice);
          const sellingPrice = item.sellingPrice == null ? null : Number(item.sellingPrice);
          if (!category || !unit || !Number.isFinite(costPrice) || !Number.isFinite(sellingPrice)) {
            unmatched.push(`${sku} (requires PASALO cost/selling price and category/unit)`);
            continue;
          }
          await tx.product.create({ data: {
            sku,
            barcode: item.barcode ? String(item.barcode) : null,
            pasalo_product_id: pasaloProductId,
            name: String(item.name).trim(),
            category_id: category.id,
            unit_id: unit.id,
            cost_price: costPrice!,
            selling_price: sellingPrice!,
            is_active: item.isActive !== false,
          } });
          linked += 1;
        }
      }
      return { synced: products.length, linked, updated, unmatched };
    });
  }

  static async getProducts(search?: string, categoryId?: string, branchId?: string) {
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

    const products = await prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true, abbreviation: true } },
        stock_balances: branchId ? { where: { location_type: 'BRANCH', location_id: branchId } } : true,
      },
      orderBy: { created_at: 'desc' },
    });
    return products;
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

  static async linkPasaloProduct(id: string, pasaloProductId: string, actorUserId?: string) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new Error('Product not found.');

    const existingMapping = await prisma.product.findUnique({
      where: { pasalo_product_id: pasaloProductId },
      select: { id: true },
    });
    if (existingMapping && existingMapping.id !== id) {
      throw new Error(`PASALO product '${pasaloProductId}' is already linked to another product.`);
    }

    const updated = await prisma.product.update({
      where: { id },
      data: { pasalo_product_id: pasaloProductId },
    });

    await AuditService.log({
      userId: actorUserId,
      action: 'PRODUCT_PASALO_LINKED',
      entity: 'Product',
      entityId: id,
      oldValues: { pasaloProductId: product.pasalo_product_id },
      newValues: { pasaloProductId },
    });

    return updated;
  }
}
