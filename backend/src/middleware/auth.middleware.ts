import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt.js';
import { sendError } from '../utils/response.js';
import { prisma } from '../db/prisma.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
    permissions: string[];
    branchId?: string | null;
  };
}

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'Authentication required. Missing or invalid Authorization header.', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    
    // Fetch user and permissions from database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.is_active) {
      return sendError(res, 'User account not found or deactivated.', 401);
    }

    const permissions = user.role.permissions.map((rp) => rp.permission.code);

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role.name,
      permissions,
      branchId: user.branch_id,
    };

    next();
  } catch (error: any) {
    return sendError(res, 'Invalid or expired access token.', 401, error.message);
  }
}

export function authorize(requiredPermissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'Authentication required.', 401);
    }

    // CEO and ADMIN bypass granular checks for administrative management
    if (req.user.role === 'CEO' || req.user.role === 'ADMIN') {
      return next();
    }

    const hasPermission = requiredPermissions.every((perm) => req.user?.permissions.includes(perm));
    if (!hasPermission) {
      return sendError(
        res,
        `Forbidden: Access denied. Missing required permission(s): ${requiredPermissions.join(', ')}`,
        403
      );
    }

    next();
  };
}
