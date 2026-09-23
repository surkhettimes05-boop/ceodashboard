import { describe, expect, it } from 'vitest';
import { validateConfig } from '../config/index.js';

describe('Config validation', () => {
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
});
