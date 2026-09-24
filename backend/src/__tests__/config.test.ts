import { describe, expect, it } from 'vitest';
import { validateConfig } from '../config/index.js';

describe('Config validation', () => {
  it('requires production NODE_ENV on Railway', () => {
    expect(() =>
      validateConfig({
        RAILWAY_ENVIRONMENT: 'production',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/app',
      })
    ).toThrow(/NODE_ENV=production/i);
  });

  it('rejects development mode on Railway', () => {
    expect(() =>
      validateConfig({
        RAILWAY_ENVIRONMENT: 'production',
        NODE_ENV: 'development',
      })
    ).toThrow(/NODE_ENV=production/i);
  });

  it('requires strong secrets in production', () => {
    expect(() =>
      validateConfig({
        NODE_ENV: 'production',
        PORT: '3001',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/app',
        JWT_SECRET: 'short',
        JWT_REFRESH_SECRET: 'another-short',
        CORS_ORIGIN: 'https://app.example.com',
      })
    ).toThrow(/JWT_SECRET.*32|JWT_REFRESH_SECRET.*32/i);
  });

  it('rejects unsafe CORS origins in production', () => {
    expect(() =>
      validateConfig({
        NODE_ENV: 'production',
        PORT: '3001',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/app',
        JWT_SECRET: '12345678901234567890123456789012',
        JWT_REFRESH_SECRET: 'abcdefghijklmnopqrstuvwxzy123456',
        CORS_ORIGIN: 'https://app.example.com,*',
      })
    ).toThrow(/CORS_ORIGIN/i);
  });

  it('requires a strong PASALO webhook secret in production', () => {
    expect(() =>
      validateConfig({
        NODE_ENV: 'production',
        PORT: '3001',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/app',
        JWT_SECRET: '12345678901234567890123456789012',
        JWT_REFRESH_SECRET: 'abcdefghijklmnopqrstuvwxzy123456',
        FEEDBACK_TOKEN_SECRET: 'feedback-secret-long-enough-to-pass-32',
        PASALO_ALLOWED_BRANCH_CODES: 'STORE-001, STORE-002',
        CORS_ORIGIN: 'https://app.example.com',
      }),
    ).toThrow(/PASALO_WEBHOOK_SECRET.*32/i);
  });
});
