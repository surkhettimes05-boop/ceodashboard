import { prisma } from '../../db/prisma.js';

export class RolesService {
  static async getRoles() {
    return prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }

  static async getPermissions() {
    return prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });
  }
}
