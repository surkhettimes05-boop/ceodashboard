import { prisma } from '../../db/prisma.js';

export class UnitsService {
  static async getUnits() {
    return prisma.unit.findMany({ orderBy: { name: 'asc' } });
  }

  static async createUnit(data: { name: string; abbreviation: string }) {
    const existing = await prisma.unit.findUnique({ where: { name: data.name } });
    if (existing) throw new Error(`Unit '${data.name}' already exists.`);

    return prisma.unit.create({
      data: {
        name: data.name,
        abbreviation: data.abbreviation,
      },
    });
  }
}
