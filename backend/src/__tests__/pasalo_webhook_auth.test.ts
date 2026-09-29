import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/index.js', () => ({ config: { pasaloWebhookSecret: 'integration-secret' } }));

import { authenticatePasaloWebhook } from '../modules/sync/pasalo-webhook.middleware.js';

describe('PASALO online fulfillment authentication', () => {
  it('rejects an unauthorized server-to-server request', () => {
    const req = { get: vi.fn().mockReturnValue('wrong-secret') } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    authenticatePasaloWebhook(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
