import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  toLocalDateString,
  getStatsDateRange,
  getBudgetQueryParams,
  buildExpenseBreakdownForRange,
  buildMonthlyFlowRub,
  buildDailyFlowRub,
  isMonthInStatsPeriod,
  daysSpanInclusive,
  getStatsMonthCount,
} from './financeStats';
import type { Transaction } from '../api/finance';

const tx = (partial: Partial<Transaction> & Pick<Transaction, 'amount' | 'transaction_type' | 'date'>): Transaction => ({
  id: 1,
  user_id: 1,
  account_id: 1,
  amount: partial.amount,
  description: partial.description || '',
  date: partial.date,
  transaction_type: partial.transaction_type,
  is_recurring: false,
  created_at: '',
  updated_at: '',
  category_name: partial.category_name,
  account_currency: partial.account_currency,
});

describe('financeStats', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 4, 12, 0, 0)); // 4 July 2026 local
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('toLocalDateString uses local calendar date', () => {
    expect(toLocalDateString(new Date(2026, 6, 4))).toBe('2026-07-04');
  });

  it('getStatsDateRange for current month starts on 1st', () => {
    const range = getStatsDateRange('month');
    expect(range.from).toBe('2026-07-01');
    expect(range.to).toBe('2026-07-04');
  });

  it('getStatsDateRange for prev month is full June', () => {
    const range = getStatsDateRange('prev_month');
    expect(range.from).toBe('2026-06-01');
    expect(range.to).toBe('2026-06-30');
  });

  it('getBudgetQueryParams for quarter returns months=3', () => {
    expect(getBudgetQueryParams('quarter')).toEqual({ months: 3 });
  });

  it('getStatsMonthCount scales quarter to 3', () => {
    expect(getStatsMonthCount('quarter')).toBe(3);
    expect(getStatsMonthCount('month')).toBe(1);
  });

  it('buildMonthlyFlowRub includes previous month when period is prev_month', () => {
    const transactions = [
      tx({ amount: 500, transaction_type: 'income', date: '2026-06-15', account_currency: 'RUB' }),
      tx({ amount: 200, transaction_type: 'expense', date: '2026-06-20', account_currency: 'RUB' }),
      tx({ amount: 100, transaction_type: 'income', date: '2026-07-01', account_currency: 'RUB' }),
    ];
    const result = buildMonthlyFlowRub(transactions, 'prev_month', () => 'RUB');
    expect(result).toHaveLength(1);
    expect(result[0].month).toBe('2026-06');
    expect(result[0].Доходы).toBe(500);
    expect(result[0].Расходы).toBe(200);
  });

  it('buildExpenseBreakdownForRange converts USD to RUB', () => {
    const transactions = [
      tx({ amount: 10, transaction_type: 'expense', date: '2026-07-02', category_name: 'Food', account_currency: 'USD' }),
    ];
    const result = buildExpenseBreakdownForRange(transactions, '2026-07-01', '2026-07-31', () => 'RUB');
    expect(result[0].value).toBe(900);
  });

  it('buildDailyFlowRub aggregates income and expense', () => {
    const transactions = [
      tx({ amount: 100, transaction_type: 'income', date: '2026-07-01', account_currency: 'RUB' }),
      tx({ amount: 40, transaction_type: 'expense', date: '2026-07-01', account_currency: 'RUB' }),
    ];
    const days = buildDailyFlowRub(transactions, '2026-07-01', '2026-07-02', () => 'RUB');
    expect(days[0].Доходы).toBe(100);
    expect(days[0].Расходы).toBe(40);
  });

  it('isMonthInStatsPeriod detects overlap', () => {
    expect(isMonthInStatsPeriod('2026-07', 'month')).toBe(true);
    expect(isMonthInStatsPeriod('2026-05', 'month')).toBe(false);
  });

  it('daysSpanInclusive counts both ends', () => {
    expect(daysSpanInclusive('2026-07-01', '2026-07-04')).toBe(4);
  });
});
