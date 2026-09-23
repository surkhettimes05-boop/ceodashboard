import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { prisma } from '../../db/prisma.js';

export interface MFASetupResult {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export class MFAService {
  /**
   * Generate a new TOTP secret for a user
   */
  static generateSecret(username: string): string {
    return speakeasy.generateSecret({
      name: `CEO Dashboard (${username})`,
      issuer: 'CEO Dashboard',
    }).base32;
  }

  /**
   * Generate QR code for TOTP setup
   */
  static async generateQRCode(secret: string, username: string): Promise<string> {
    const otpauthUrl = speakeasy.otpauthURL({
      secret,
      label: `CEO Dashboard (${username})`,
      issuer: 'CEO Dashboard',
      encoding: 'base32',
    });
    
    return await QRCode.toDataURL(otpauthUrl);
  }

  /**
   * Generate backup codes for MFA recovery
   */
  static generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character hex code
      const code = Array.from(crypto.getRandomValues(new Uint8Array(4)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Setup MFA for a user
   */
  static async setupMFA(userId: string): Promise<MFASetupResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Generate secret
    const secret = this.generateSecret(user.username);
    
    // Generate QR code
    const qrCode = await this.generateQRCode(secret, user.username);
    
    // Generate backup codes
    const backupCodes = this.generateBackupCodes();

    // Store in database (not enabled yet, needs verification)
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfa_secret: secret,
        mfa_backup_codes: backupCodes,
        mfa_enabled: false,
      },
    });

    return {
      secret,
      qrCode,
      backupCodes,
    };
  }

  /**
   * Verify TOTP token
   */
  static verifyToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps before and after for clock drift
    });
  }

  /**
   * Verify backup code
   */
  static verifyBackupCode(backupCodes: string[], code: string): boolean {
    return backupCodes.includes(code.toUpperCase());
  }

  /**
   * Enable MFA for a user after verification
   */
  static async enableMFA(userId: string, token: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const secret = user.mfa_secret;
    if (!secret) {
      throw new Error('MFA not set up for this user');
    }

    // Verify token
    const isValid = this.verifyToken(secret, token);
    if (!isValid) {
      throw new Error('Invalid MFA token');
    }

    // Enable MFA
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfa_enabled: true,
        mfa_verified_at: new Date(),
      },
    });

    return true;
  }

  /**
   * Disable MFA for a user
   */
  static async disableMFA(userId: string): Promise<boolean> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfa_enabled: false,
        mfa_secret: null,
        mfa_backup_codes: [],
        mfa_verified_at: null,
      },
    });

    return true;
  }

  /**
   * Check if MFA is required for a user
   */
  static async isMFARequired(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
      },
    });

    if (!user) {
      return false;
    }

    // Require MFA for admin roles
    const adminRoles = ['CEO', 'ADMIN'];
    return adminRoles.includes(user.role.name);
  }

  /**
   * Verify MFA during login
   */
  static async verifyLoginMFA(userId: string, token: string, isBackupCode: boolean = false): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.mfa_enabled) {
      return true; // MFA not enabled, skip verification
    }

    if (isBackupCode) {
      const isValid = this.verifyBackupCode(user.mfa_backup_codes || [], token);
      if (isValid) {
        // Remove used backup code
        const remainingCodes = (user.mfa_backup_codes || []).filter(c => c !== token.toUpperCase());
        await prisma.user.update({
          where: { id: userId },
          data: { mfa_backup_codes: remainingCodes },
        });
      }
      return isValid;
    }

    return this.verifyToken(user.mfa_secret || '', token);
  }
}
