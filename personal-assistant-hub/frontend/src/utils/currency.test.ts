import { describe, it, expect } from 'vitest';
import { toRub, currencySymbol, formatMoney } from './currency';

describe('currency utils', () => {
  it('toRub keeps RUB unchanged', () => {
    expect(toRub(100, 'RUB')).toBe(100);
  });

  it('toRub converts USD with default rate', () => {
    expect(toRub(10, 'USD')).toBe(900);
  });

  it('currencySymbol returns symbols', () => {
    expect(currencySymbol('USD')).toBe('$');
    expect(currencySymbol('RUB')).toBe('₽');
  });

  it('formatMoney formats with symbol', () => {
    expect(formatMoney(1000, 'RUB')).toContain('₽');
  });
});
