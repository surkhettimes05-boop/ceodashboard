import { prisma } from '../../db/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { CreateUserInput, UpdateUserInput } from './users.schema.js';
import { AuditService } from '../audit/audit.service.js';

export class UsersService {
  static async getUsers() {
    return prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        full_name: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        branch: {
          select: { id: true, name: true, code: true },
        },
        role: {
          select: { id: true, name: true, description: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  static async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        branch: true,
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    if (!user) throw new Error('User not found.');
    return user;
  }

  static async createUser(input: CreateUserInput, actorUserId?: string) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username: input.username }, { email: input.email }],
      },
    });

    if (existing) {
      throw new Error('User with this username or email already exists.');
    }

    const role = await prisma.role.findUnique({
      where: { name: input.roleName },
    });

    if (!role) {
      throw new Error(`Role ${input.roleName} does not exist.`);
    }

    const passwordHash = await hashPassword(input.password);

    const newUser = await prisma.user.create({
      data: {
        username: input.username,
        email: input.email,
        password_hash: passwordHash,
        full_name: input.fullName,
        role_id: role.id,
        branch_id: input.branchId || null,
      },
      select: {
        id: true,
        username: true,
        email: true,
        full_name: true,
        is_active: true,
        created_at: true,
        role: { select: { name: true } },
      },
    });

    await AuditService.log({
      userId: actorUserId,
      action: 'USER_CREATED',
      entity: 'User',
      entityId: newUser.id,
      newValues: { username: newUser.username, role: input.roleName },
    });

    return newUser;
  }

  static async updateUser(id: string, input: UpdateUserInput, actorUserId?: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('User not found.');

    let roleId = user.role_id;
    if (input.roleName) {
      const role = await prisma.role.findUnique({ where: { name: input.roleName } });
      if (!role) throw new Error(`Role ${input.roleName} not found.`);
      roleId = role.id;
    }

    let passwordHash = user.password_hash;
    if (input.password) {
      passwordHash = await hashPassword(input.password);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        email: input.email ?? user.email,
        full_name: input.fullName ?? user.full_name,
        password_hash: passwordHash,
        role_id: roleId,
        branch_id: input.branchId !== undefined ? input.branchId : user.branch_id,
        is_active: input.isActive !== undefined ? input.isActive : user.is_active,
      },
      select: {
        id: true,
        username: true,
        email: true,
        full_name: true,
        is_active: true,
        role: { select: { name: true } },
      },
    });

    await AuditService.log({
      userId: actorUserId,
      action: 'USER_UPDATED',
      entity: 'User',
      entityId: id,
      oldValues: { email: user.email, is_active: user.is_active },
      newValues: { email: updated.email, is_active: updated.is_active },
    });

    return updated;
  }
}
