import { evaluateReadiness } from '../health/readiness.js';
import { describe, expect, it } from 'vitest';

describe('CEO readiness', () => {
  it('requires the database but does not fake Redis or block on optional reporting configuration', async () => {
    await expect(evaluateReadiness(async () => undefined, false)).resolves.toEqual({
      ready: true,
      checks: { database: 'ok', pasalho_reporting: 'not_configured' },
    });
  });

  it('fails readiness when the required database is unavailable', async () => {
    await expect(evaluateReadiness(async () => { throw new Error('db down'); }, true)).resolves.toEqual({
      ready: false,
      checks: { database: 'error', pasalho_reporting: 'configured' },
    });
  });
});
