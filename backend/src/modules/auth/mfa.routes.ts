import { Router } from 'express';
import { MFAService } from './mfa.service.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { AuthService } from './auth.service.js';

const router = Router();

/**
 * POST /api/auth/mfa/setup
 * Setup MFA for the authenticated user
 * Returns TOTP secret, QR code, and backup codes
 */
router.post('/setup', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const result = await MFAService.setupMFA(userId);
    
    res.json({
      success: true,
      data: {
        secret: result.secret,
        qrCode: result.qrCode,
        backupCodes: result.backupCodes,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to setup MFA',
    });
  }
});

/**
 * POST /api/auth/mfa/enable
 * Enable MFA after verifying the TOTP token
 */
router.post('/enable', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    await MFAService.enableMFA(userId, token);
    
    res.json({
      success: true,
      message: 'MFA enabled successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to enable MFA',
    });
  }
});

/**
 * POST /api/auth/mfa/disable
 * Disable MFA for the authenticated user
 */
router.post('/disable', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    await MFAService.disableMFA(userId);
    
    res.json({
      success: true,
      message: 'MFA disabled successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to disable MFA',
    });
  }
});

/**
 * POST /api/auth/mfa/verify
 * Verify MFA token during login
 */
router.post('/verify', async (req, res) => {
  try {
    const { challengeToken, token, isBackupCode } = req.body;
    
    if (!challengeToken || !token) {
      return res.status(400).json({ 
        success: false, 
        message: 'challengeToken and token are required' 
      });
    }

    const result = await AuthService.completeMFAChallenge(challengeToken, token, isBackupCode);
    res.json({ success: true, data: result, message: 'MFA verified successfully' });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error instanceof Error ? error.message : 'MFA verification failed',
    });
  }
});

/**
 * GET /api/auth/mfa/status
 * Get MFA status for the authenticated user
 */
router.get('/status', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { prisma } = await import('../../db/prisma.js');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        mfa_enabled: true,
        mfa_verified_at: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isRequired = await MFAService.isMFARequired(userId);

    res.json({
      success: true,
      data: {
        enabled: user.mfa_enabled,
        required: isRequired,
        verifiedAt: user.mfa_verified_at,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get MFA status',
    });
  }
});

export default router;
