import { describe, expect, it } from 'vitest';
import { formatNPR } from './formatNpr';

describe('formatNPR', () => {
  it('formats Indian grouping with default Rs. symbol', () => {
    expect(formatNPR(100000)).toBe('Rs. 1,00,000.00');
    expect(formatNPR(10000000)).toBe('Rs. 1,00,00,000.00');
  });

  it('formats zero and negative values safely', () => {
    expect(formatNPR(0)).toBe('Rs. 0.00');
    expect(formatNPR(-125000)).toBe('Rs. -1,25,000.00');
  });

  it('handles values with paisa and rounding rules', () => {
    expect(formatNPR(12.345)).toBe('Rs. 12.35');
    expect(formatNPR(0.005)).toBe('Rs. 0.01');
    expect(formatNPR(125.675)).toBe('Rs. 125.68');
  });

  it('formats compact values at the expected thresholds', () => {
    expect(formatNPR(99999, { compact: true })).toBe('Rs. 99,999.00');
    expect(formatNPR(100000, { compact: true })).toBe('Rs. 1 L');
    expect(formatNPR(1250000, { compact: true })).toBe('Rs. 12.5 L');
    expect(formatNPR(10000000, { compact: true })).toBe('Rs. 1 Cr');
  });

  it('supports the Nepali symbol option', () => {
    expect(formatNPR(125000, { symbol: 'रू' })).toBe('रू 1,25,000.00');
    expect(formatNPR(1250000, { compact: true, symbol: 'रू' })).toBe('रू 12.5 L');
  });

  it('never renders NaN for invalid or empty input values', () => {
    expect(formatNPR(null)).toBe('Rs. 0.00');
    expect(formatNPR(undefined)).toBe('Rs. 0.00');
    expect(formatNPR(NaN)).toBe('Rs. 0.00');
    expect(formatNPR('')).toBe('Rs. 0.00');
    expect(formatNPR('abc')).toBe('Rs. 0.00');
    expect(formatNPR('125000')).toBe('Rs. 1,25,000.00');
  });
});
