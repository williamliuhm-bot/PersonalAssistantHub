const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: '₽',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

const RATES_TO_RUB: Record<string, number> = {
  RUB: 1,
  USD: Number(import.meta.env.VITE_RATE_USD_RUB) || 90,
  EUR: Number(import.meta.env.VITE_RATE_EUR_RUB) || 98,
  GBP: Number(import.meta.env.VITE_RATE_GBP_RUB) || 115,
};

export function toRub(amount: number, currency?: string): number {
  const code = (currency || 'RUB').toUpperCase();
  const rate = RATES_TO_RUB[code] ?? 1;
  return Math.round(Number(amount) * rate * 100) / 100;
}

export function currencySymbol(currency?: string): string {
  if (!currency) return '₽';
  return CURRENCY_SYMBOLS[currency.toUpperCase()] || currency.toUpperCase();
}

export function formatMoney(amount: number, currency?: string): string {
  const symbol = currencySymbol(currency);
  const code = currency?.toUpperCase();
  if (code && !CURRENCY_SYMBOLS[code]) {
    return `${Number(amount).toLocaleString()} ${code}`;
  }
  return `${Number(amount).toLocaleString()} ${symbol}`;
}
