export type FormatNPROptions = {
  compact?: boolean;
  symbol?: 'Rs.' | 'रू';
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

const toSafeNumber = (value: number | string | null | undefined) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === 'nan') return 0;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const roundToPlaces = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const formatCompactValue = (value: number) => {
  const abs = Math.abs(value);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(abs);

  return value < 0 ? `-${formatted}` : formatted;
};

export function formatNPR(value: number | string | null | undefined, options: FormatNPROptions = {}) {
  const amount = toSafeNumber(value);
  const symbol = options.symbol ?? 'Rs.';
  const compact = options.compact ?? false;
  const minimumFractionDigits = options.minimumFractionDigits ?? 2;
  const maximumFractionDigits = options.maximumFractionDigits ?? 2;

  if (compact) {
    const abs = Math.abs(amount);
    if (abs >= 10000000) {
      return `${symbol} ${formatCompactValue(roundToPlaces(amount / 10000000, 1))} Cr`;
    }
    if (abs >= 100000) {
      return `${symbol} ${formatCompactValue(roundToPlaces(amount / 100000, 1))} L`;
    }
  }

  const roundedAmount = roundToPlaces(amount, maximumFractionDigits);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(roundedAmount);

  return `${symbol} ${formatted}`;
}
