import { prisma } from '../../db/prisma.js';

export class CategoriesService {
  static async getCategories() {
    return prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
  }

  static async createCategory(data: { name: string; description?: string }) {
    const existing = await prisma.category.findUnique({ where: { name: data.name } });
    if (existing) throw new Error(`Category '${data.name}' already exists.`);

    return prisma.category.create({
      data: {
        name: data.name,
        description: data.description || null,
      },
    });
  }
}
