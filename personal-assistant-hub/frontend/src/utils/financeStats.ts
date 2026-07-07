import type { Transaction } from '../api/finance';
import { convertCurrency } from './currency';

export type StatsPeriod = 'month' | 'prev_month' | 'quarter';

const MONTH_NAMES_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

const formatDateRu = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTH_NAMES_GEN[month - 1]} ${year}`;
};

export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toLocalYearMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getStatsMonthCount(period: StatsPeriod): number {
  if (period === 'quarter') return 3;
  return 1;
}

export function getStatsDateRange(period: StatsPeriod): { from: string; to: string } {
  const now = new Date();
  if (period === 'month') {
    return {
      from: toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: toLocalDateString(now),
    };
  }
  if (period === 'prev_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: toLocalDateString(start), to: toLocalDateString(end) };
  }
  const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  return { from: toLocalDateString(start), to: toLocalDateString(now) };
}

export function getStatsYearMonths(period: StatsPeriod): string[] {
  const now = new Date();
  if (period === 'month') {
    return [toLocalYearMonth(now)];
  }
  if (period === 'prev_month') {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return [toLocalYearMonth(d)];
  }
  return [2, 1, 0].map((offset) =>
    toLocalYearMonth(new Date(now.getFullYear(), now.getMonth() - offset, 1)),
  );
}

export function formatStatsPeriodRange(period: StatsPeriod): string {
  const { from, to } = getStatsDateRange(period);
  return `${formatDateRu(from)} — ${formatDateRu(to)}`;
}

export function getStatsPeriodDescription(period: StatsPeriod): string {
  if (period === 'month') {
    return 'Операции с 1-го числа текущего месяца';
  }
  if (period === 'prev_month') {
    return 'Операции за полный прошлый календарный месяц';
  }
  return 'Операции за 3 календарных месяца (текущий и два предыдущих). Лимиты бюджетов суммируются';
}

export function getBudgetQueryParams(period: StatsPeriod): { year?: number; month?: number; months?: number } {
  const now = new Date();
  if (period === 'month') {
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  if (period === 'prev_month') {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }
  return { months: 3 };
}

export function getBalanceHistoryDays(period: StatsPeriod): number {
  const { from, to } = getStatsDateRange(period);
  const start = new Date(from);
  const end = new Date(to);
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000));
}

export function filterTrendsByPeriod(
  trends: { month: string; income: number; expenses: number }[],
  period: StatsPeriod,
) {
  const allowed = new Set(getStatsYearMonths(period));
  return trends.filter((t) => allowed.has(t.month));
}

export function isMonthInStatsPeriod(yearMonth: string, period: StatsPeriod): boolean {
  const { from, to } = getStatsDateRange(period);
  const monthStart = `${yearMonth}-01`;
  const [y, m] = yearMonth.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
  return monthEnd >= from && monthStart <= to;
}

export function buildMonthlyFlowRub(
  transactions: Transaction[],
  period: StatsPeriod,
  getCurrency: (tx: Transaction) => string,
  targetCurrency = 'RUB',
): { month: string; Доходы: number; Расходы: number }[] {
  const yearMonths = getStatsYearMonths(period).sort();
  const totals: Record<string, { income: number; expense: number }> = {};
  yearMonths.forEach((ym) => {
    totals[ym] = { income: 0, expense: 0 };
  });

  transactions.forEach((tx) => {
    const date = tx.date?.slice(0, 10);
    if (!date) return;
    const ym = date.slice(0, 7);
    if (!totals[ym]) return;
    const amount = convertCurrency(Number(tx.amount), tx.account_currency || getCurrency(tx), targetCurrency);
    const type = String(tx.transaction_type || '').toLowerCase();
    if (type === 'income') totals[ym].income += amount;
    else if (type === 'expense') totals[ym].expense += amount;
  });

  return yearMonths.map((month) => ({
    month,
    Доходы: totals[month].income,
    Расходы: totals[month].expense,
  }));
}

export function buildExpenseBreakdownRub(
  transactions: Transaction[],
  period: StatsPeriod,
  getCurrency: (tx: Transaction) => string,
  targetCurrency = 'RUB',
): { name: string; value: number }[] {
  const { from, to } = getStatsDateRange(period);
  return buildExpenseBreakdownForRange(transactions, from, to, getCurrency, targetCurrency);
}

export function buildExpenseBreakdownForRange(
  transactions: Transaction[],
  from: string,
  to: string,
  getCurrency: (tx: Transaction) => string,
  targetCurrency = 'RUB',
): { name: string; value: number }[] {
  const totals: Record<string, number> = {};

  transactions.forEach((tx) => {
    if (tx.transaction_type !== 'expense') return;
    const date = tx.date?.slice(0, 10);
    if (!date || date < from || date > to) return;
    const category = tx.category_name || 'Без категории';
    const currency = tx.account_currency || getCurrency(tx);
    totals[category] = (totals[category] || 0) + convertCurrency(Number(tx.amount), currency, targetCurrency);
  });

  return Object.entries(totals)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function buildDailyFlowRub(
  transactions: Transaction[],
  from: string,
  to: string,
  getCurrency: (tx: Transaction) => string,
  targetCurrency = 'RUB',
): { date: string; label: string; Доходы: number; Расходы: number }[] {
  const byDate: Record<string, { income: number; expense: number }> = {};

  transactions.forEach((tx) => {
    const date = tx.date?.slice(0, 10);
    if (!date || date < from || date > to) return;
    if (!byDate[date]) byDate[date] = { income: 0, expense: 0 };
    const amount = convertCurrency(Number(tx.amount), tx.account_currency || getCurrency(tx), targetCurrency);
    if (tx.transaction_type === 'income') byDate[date].income += amount;
    else byDate[date].expense += amount;
  });

  const days: { date: string; label: string; Доходы: number; Расходы: number }[] = [];
  const cursor = new Date(from);
  const end = new Date(to);
  while (cursor <= end) {
    const iso = toLocalDateString(cursor);
    const totals = byDate[iso] || { income: 0, expense: 0 };
    days.push({
      date: iso,
      label: `${String(cursor.getDate()).padStart(2, '0')}.${String(cursor.getMonth() + 1).padStart(2, '0')}`,
      Доходы: totals.income,
      Расходы: totals.expense,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function getDefaultReportRange(): { from: string; to: string } {
  const now = new Date();
  return {
    from: toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toLocalDateString(now),
  };
}

export function formatDateRangeRu(from: string, to: string): string {
  return `${formatDateRu(from)} — ${formatDateRu(to)}`;
}

export function formatSingleDateRu(iso: string): string {
  return formatDateRu(iso);
}

export function daysSpanInclusive(from: string, to: string): number {
  const start = new Date(from);
  const end = new Date(to);
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
}

export function daysFromDateToToday(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(isoDate);
  d.setHours(0, 0, 0, 0);
  return Math.max(1, Math.floor((today.getTime() - d.getTime()) / 86400000) + 1);
}
