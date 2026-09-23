import { prisma } from '../../db/prisma.js';
import { comparePassword } from '../../utils/password.js';
import { generateAccessToken, generateMFAChallengeToken, generateRefreshToken, verifyMFAChallengeToken, verifyRefreshToken } from '../../utils/jwt.js';
import { LoginInput } from './auth.schema.js';
import { AuditService } from '../audit/audit.service.js';
import { MFAService } from './mfa.service.js';

const failedLoginAttempts = new Map<string, { count: number; firstAttempt: number; lockedUntil?: number }>();

function getLoginKey(username: string, ipAddress?: string) {
  const sanitized = `${(username || '').trim().toLowerCase()}::${ipAddress || 'unknown'}`;
  return sanitized;
}

function applyLoginFailure(key: string) {
  const now = Date.now();
  const current = failedLoginAttempts.get(key) || { count: 0, firstAttempt: now };
  const windowMs = 15 * 60 * 1000;

  if (current.firstAttempt + windowMs < now) {
    failedLoginAttempts.set(key, { count: 1, firstAttempt: now });
    return;
  }

  const nextCount = current.count + 1;
  if (nextCount >= 6) {
    failedLoginAttempts.set(key, {
      count: nextCount,
      firstAttempt: current.firstAttempt,
      lockedUntil: now + windowMs,
    });
    return;
  }

  failedLoginAttempts.set(key, { count: nextCount, firstAttempt: current.firstAttempt });
}

export class AuthService {
  static async login(input: LoginInput, ipAddress?: string) {
    const loginKey = getLoginKey(input.username, ipAddress);
    const now = Date.now();
    const currentAttempt = failedLoginAttempts.get(loginKey);

    if (currentAttempt && currentAttempt.lockedUntil && currentAttempt.lockedUntil > now) {
      throw new Error('Too many failed login attempts. Please try again later.');
    }

    if (currentAttempt && currentAttempt.firstAttempt + 15 * 60 * 1000 < now) {
      failedLoginAttempts.delete(loginKey);
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: input.username },
          { email: input.username },
        ],
      },
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
        branch: true,
      },
    });

    if (!user) {
      applyLoginFailure(loginKey);
      throw new Error('Invalid credentials.');
    }

    if (!user.is_active) {
      throw new Error('Account is deactivated. Contact system administrator.');
    }

    const isMatch = await comparePassword(input.password, user.password_hash);
    if (!isMatch) {
      applyLoginFailure(loginKey);
      throw new Error('Invalid credentials.');
    }

    failedLoginAttempts.delete(loginKey);

    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role.name,
      branchId: user.branch_id,
    };

    if (user.mfa_enabled) {
      return {
        mfaRequired: true,
        challengeToken: generateMFAChallengeToken(payload),
      };
    }

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await AuditService.log({
      userId: user.id,
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: user.id,
      ipAddress,
    });

    const permissions = user.role.permissions.map((rp) => rp.permission.code);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role.name,
        branchId: user.branch_id,
        branchName: user.branch?.name || null,
        permissions,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  static async completeMFAChallenge(challengeToken: string, token: string, isBackupCode = false) {
    const payload = verifyMFAChallengeToken(challengeToken);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { role: { include: { permissions: { include: { permission: true } } } }, branch: true },
    });

    if (!user || !user.is_active || !user.mfa_enabled) {
      throw new Error('MFA challenge is no longer valid.');
    }

    const verified = isBackupCode
      ? await this.verifyBackupCodeForLogin(user.id, token)
      : MFAService.verifyToken(user.mfa_secret || '', token);
    if (!verified) throw new Error('Invalid MFA token.');

    const tokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role.name,
      branchId: user.branch_id,
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    const permissions = user.role.permissions.map((rp) => rp.permission.code);

    await AuditService.log({ userId: user.id, action: 'USER_LOGIN_MFA', entity: 'User', entityId: user.id });

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role.name,
        branchId: user.branch_id,
        branchName: user.branch?.name || null,
        permissions,
      },
      tokens: { accessToken, refreshToken },
    };
  }

  private static async verifyBackupCodeForLogin(userId: string, token: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { mfa_backup_codes: true } });
    if (!user) return false;
    const normalizedToken = token.toUpperCase();
    if (!(user.mfa_backup_codes || []).includes(normalizedToken)) return false;
    await prisma.user.update({
      where: { id: userId },
      data: { mfa_backup_codes: (user.mfa_backup_codes || []).filter((code) => code !== normalizedToken) },
    });
    return true;
  }

  static async refresh(refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { role: true },
    });

    if (!user || !user.is_active) {
      throw new Error('Invalid token or user deactivated.');
    }

    const tokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role.name,
      branchId: user.branch_id,
    };

    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }
}
