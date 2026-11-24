export interface PricingConfig {
  baseHourlyInr: number;
  usdRate: number;
  baseHourlyUsd: number;
  minHours: number;
  maxHours: number;
  discountByHour: Record<number, number>;
  includedFeatures: string[];
  screenCapturesPerHour: number;
}

export const PRICING_CONFIG: PricingConfig = {
  baseHourlyInr: 799,
  usdRate: 84,
  baseHourlyUsd: 10,
  minHours: 1,
  maxHours: 40,
  // Exact progressive discount curve:
  // 1h: 0%, 2h: 9%, 3h: 21%, 4h: 30%, 5h: 35%, 6h: 40%, 7h: 43%, 8h: 46%,
  // 9h+: +1% per hour up to 68.7% max at 40h
  discountByHour: {
    1: 0,
    2: 9,
    3: 21,
    4: 30,
    5: 35,
    6: 40,
    7: 43,
    8: 46,
  },
  includedFeatures: [
    'Instant activation in Crackpilot app via Auth Token',
    'Unused minutes, screen captures & written prompts never expire',
    'Private eye-level teleprompter mode and zero-cursor copying supported',
    'Includes unlimited live audio listening & local QR mobile remote',
  ],
  screenCapturesPerHour: 20,
};

export function getDiscountPercent(hours: number): number {
  const rounded = Math.max(1, Math.min(PRICING_CONFIG.maxHours, Math.round(hours)));
  if (rounded in PRICING_CONFIG.discountByHour) {
    return PRICING_CONFIG.discountByHour[rounded];
  }
  // +1% for each hour after 8 (9h=47%, 10h=48%, ..., 30h=68%), capping cleanly at 68.7%
  const linear = 46 + (rounded - 8);
  return Math.min(68.7, linear);
}

export function calculatePrice(hours: number, currency: 'INR' | 'USD') {
  const discountPct = getDiscountPercent(hours);
  const discountLabel =
    discountPct > 0 ? `${discountPct}% OFF` : 'Standard pay-per-use';

  const baseRate =
    currency === 'INR'
      ? PRICING_CONFIG.baseHourlyInr
      : PRICING_CONFIG.baseHourlyUsd;
  const subtotal = baseRate * hours;
  const discountAmount = Math.round((subtotal * discountPct) / 100);
  const total = subtotal - discountAmount;
  const effectivePerHour =
    currency === 'INR'
      ? Math.round(total / hours)
      : Math.round((total / hours) * 100) / 100;

  return {
    hours,
    minutes: hours * 60,
    captures: hours * PRICING_CONFIG.screenCapturesPerHour,
    currency,
    baseRate,
    subtotal,
    discountPct,
    discountLabel,
    discountAmount,
    total,
    effectivePerHour,
  };
}

export function formatCurrency(amount: number, currency: 'INR' | 'USD'): string {
  if (currency === 'INR') {
    return `₹${amount.toLocaleString('en-IN')}`;
  }
  return `$${amount.toLocaleString('en-US')}`;
}
