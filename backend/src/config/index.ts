import { z } from 'zod';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';
import { initializeSecrets } from './secrets.js';

dotenv.config();

// Initialize secrets from configured source (env, aws, or vault)
// This should be called during application startup before config validation
// Set SECRET_SOURCE environment variable to 'env' (default), 'aws', or 'vault'
export async function initSecrets() {
  try {
    await initializeSecrets();
    logger.info('Secrets loaded successfully');
  } catch (error) {
    // If secret management fails, fall back to environment variables
    logger.warn('Failed to load secrets from secret source, using environment variables', { error: error instanceof Error ? error.message : String(error) });
  }
}

const validDatabaseUrl = /^(postgresql|postgres):\/\//i;

export function parseAllowedOrigins(rawOrigin: string): string[] {
  return rawOrigin
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function validateConfig(rawEnv: Record<string, string | undefined> = process.env) {
  const nodeEnv = (rawEnv.NODE_ENV ?? 'development').trim() || 'development';
  const port = Number(rawEnv.PORT ?? '3001');
  const databaseUrl = (rawEnv.DATABASE_URL ?? '').trim();
  const jwtSecret = (rawEnv.JWT_SECRET ?? '').trim();
  const jwtRefreshSecret = (rawEnv.JWT_REFRESH_SECRET ?? '').trim();
  const feedbackTokenSecret = (rawEnv.FEEDBACK_TOKEN_SECRET ?? '').trim();
  const jwtExpiresIn = (rawEnv.JWT_EXPIRES_IN ?? '15m').trim() || '15m';
  const corsOrigin = (rawEnv.CORS_ORIGIN ?? 'http://localhost:5173').trim();

  const errors: string[] = [];
  const isProduction = nodeEnv === 'production';

  if (isProduction) {
    if (!jwtSecret || jwtSecret.length < 32) {
      errors.push('Production requires JWT_SECRET to be set and at least 32 characters long.');
    }
    if (!jwtRefreshSecret || jwtRefreshSecret.length < 32) {
      errors.push('Production requires JWT_REFRESH_SECRET to be set and at least 32 characters long.');
    }
    if (jwtSecret && jwtRefreshSecret && jwtSecret === jwtRefreshSecret) {
      errors.push('Production requires JWT_SECRET and JWT_REFRESH_SECRET to differ.');
    }
    if (!feedbackTokenSecret || feedbackTokenSecret.length < 32) {
      errors.push('Production requires FEEDBACK_TOKEN_SECRET to be set and at least 32 characters long.');
    }
    if (!databaseUrl || !validDatabaseUrl.test(databaseUrl)) {
      errors.push('Production requires DATABASE_URL to be set to a valid PostgreSQL connection string.');
    }
    const allowedOrigins = parseAllowedOrigins(corsOrigin);
    if (!allowedOrigins.length || corsOrigin.includes('*') || /localhost|127\.0\.0\.1/i.test(corsOrigin)) {
      errors.push('Production requires explicit CORS_ORIGIN values without "*" or localhost.');
    }
  } else {
    const warnings: string[] = [];
    if (!jwtSecret) {
      warnings.push('JWT_SECRET is not set; using a development fallback.');
    }
    if (!jwtRefreshSecret) {
      warnings.push('JWT_REFRESH_SECRET is not set; using a development fallback.');
    }
    if (!feedbackTokenSecret) {
      warnings.push('FEEDBACK_TOKEN_SECRET is not set; feedback token features will be unavailable.');
    }
    if (!databaseUrl) {
      warnings.push('DATABASE_URL is not set; using a local development default.');
    }
    if (!corsOrigin || corsOrigin.includes('*')) {
      warnings.push('CORS_ORIGIN is missing or wildcarded; using a development default.');
    }
    if (warnings.length) {
      logger.warn('Development mode warnings', { warnings });
    }
  }

  if (errors.length) {
    throw new Error(`Invalid production configuration: ${errors.join(' ')}`);
  }

  const configShape = z.object({
    port: z.number().int().positive().default(3001),
    nodeEnv: z.enum(['development', 'test', 'production']).default('development'),
    databaseUrl: z.string().min(1),
    jwtSecret: z.string().min(32),
    jwtRefreshSecret: z.string().min(32),
    feedbackTokenSecret: z.string().min(1),
    jwtExpiresIn: z.string().min(1),
    corsOrigin: z.string().min(1),
    corsAllowedOrigins: z.array(z.string().min(1)),
  });

  const resolvedConfig = {
    port: Number.isFinite(port) && port > 0 ? port : 3001,
    nodeEnv,
    databaseUrl: databaseUrl || 'postgresql://postgres:postgres@localhost:5432/ceodashboard?schema=public',
    jwtSecret: jwtSecret || 'dev-jwt-secret-key-change-me-in-production-1224',
    jwtRefreshSecret: jwtRefreshSecret || 'dev-jwt-refresh-secret-key-change-me-in-production-1224',
    feedbackTokenSecret,
    jwtExpiresIn,
    corsOrigin: corsOrigin || 'http://localhost:5173',
    corsAllowedOrigins: parseAllowedOrigins(corsOrigin || 'http://localhost:5173'),
  };

  return configShape.parse(resolvedConfig);
}

export const config = validateConfig();
