import { describe, it, expect } from 'vitest';
import { generateAccessToken, verifyAccessToken } from '../utils/jwt.js';
import { hashPassword, comparePassword } from '../utils/password.js';

describe('Phase B — Auth & Security Utilities', () => {
  it('should hash and compare passwords correctly', async () => {
    const password = 'SuperSecret123!';
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    
    const isValid = await comparePassword(password, hash);
    expect(isValid).toBe(true);

    const isInvalid = await comparePassword('WrongPassword', hash);
    expect(isInvalid).toBe(false);
  });

  it('should generate and verify JWT access tokens', () => {
    const payload = {
      userId: 'test-user-id-123',
      username: 'cashier1',
      role: 'CASHIER',
      branchId: 'branch-456',
    };

    const token = generateAccessToken(payload);
    expect(token).toBeDefined();

    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.username).toBe(payload.username);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.branchId).toBe(payload.branchId);
  });
});
