import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface TokenPayload {
  userId: string;
  username: string;
  role: string;
  branchId?: string | null;
}

export interface MFAChallengePayload extends TokenPayload {
  purpose: 'MFA_CHALLENGE';
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtRefreshSecret, {
    expiresIn: '7d',
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtSecret) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtRefreshSecret) as TokenPayload;
}

export function generateMFAChallengeToken(payload: TokenPayload): string {
  return jwt.sign({ ...payload, purpose: 'MFA_CHALLENGE' }, config.jwtSecret, { expiresIn: '5m' });
}

export function verifyMFAChallengeToken(token: string): MFAChallengePayload {
  const payload = jwt.verify(token, config.jwtSecret) as MFAChallengePayload;
  if (payload.purpose !== 'MFA_CHALLENGE') {
    throw new Error('Invalid MFA challenge token.');
  }
  return payload;
}
