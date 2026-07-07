import * as XLSX from 'xlsx';
import { financeApi } from '../api/finance';
import { tasksApi } from '../api/tasks';
import { analyticsApi } from '../api/analytics';

export type ExportFormat = 'csv' | 'xlsx';

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const str = value == null ? '' : String(value);
    if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}`;
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  downloadBlob(filename, new Blob([rowsToCsv(rows)], { type: 'text/csv;charset=utf-8' }));
}

function downloadExcel(filename: string, sheets: Record<string, Record<string, unknown>[]>) {
  const wb = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, rows]) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ info: 'No data' }]);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });
  XLSX.writeFile(wb, filename);
}

function stamp() {
  return Date.now();
}

async function fetchFinanceBundle() {
  const [accounts, transactions, categories, budgets] = await Promise.all([
    financeApi.getAccounts().then((r) => r.data).catch(() => []),
    financeApi.getTransactions({ per_page: 1000 }).then((r) => r.data).catch(() => []),
    financeApi.getCategories().then((r) => r.data).catch(() => []),
    financeApi.getBudgets().then((r) => r.data).catch(() => []),
  ]);
  return { accounts, transactions, categories, budgets };
}

function financeSheets(data: Awaited<ReturnType<typeof fetchFinanceBundle>>) {
  return {
    Accounts: data.accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balance: a.balance,
      currency: a.currency,
    })),
    Transactions: data.transactions.map((t) => ({
      id: t.id,
      date: t.date,
      type: t.transaction_type,
      amount: t.amount,
      currency: t.account_currency,
      category: t.category_name,
      description: t.description,
      account_id: t.account_id,
    })),
    Categories: data.categories.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      color: c.color,
    })),
    Budgets: data.budgets.map((b) => ({
      id: b.id,
      category: b.category_name,
      limit: b.limit_amount,
      spent: b.spent_amount,
      period: b.period,
    })),
  };
}

export async function exportAllUserData(format: ExportFormat) {
  const [finance, tasks, habits, insights] = await Promise.all([
    fetchFinanceBundle(),
    tasksApi.getTasks().then((r) => r.data).catch(() => []),
    tasksApi.getHabits().then((r) => r.data).catch(() => []),
    analyticsApi.getInsights().then((r) => r.data).catch(() => null),
  ]);

  const ts = stamp();
  if (format === 'csv') {
    const rows = [
      ...finance.transactions.map((t) => ({ module: 'finance', ...t })),
      ...tasks.map((t) => ({ module: 'tasks', ...t })),
      ...habits.map((h) => ({ module: 'habits', ...h })),
    ];
    downloadCsv(`personal-assistant-export-${ts}.csv`, rows);
    return;
  }

  downloadExcel(`personal-assistant-export-${ts}.xlsx`, {
    ...financeSheets(finance),
    Tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      deadline: t.deadline,
      project_id: t.project_id,
    })),
    Habits: habits.map((h) => ({
      id: h.id,
      title: h.title,
      frequency: h.frequency,
      streak: h.streak,
    })),
    Analytics: insights ? [{ insight: insights.insight }] : [],
  });
}

export async function exportFinanceData(format: ExportFormat) {
  const data = await fetchFinanceBundle();
  const ts = stamp();
  if (format === 'csv') {
    downloadCsv(`finance-transactions-${ts}.csv`, data.transactions.map((t) => ({
      id: t.id,
      date: t.date,
      type: t.transaction_type,
      amount: t.amount,
      currency: t.account_currency,
      category: t.category_name,
      description: t.description,
    })));
    return;
  }
  downloadExcel(`finance-export-${ts}.xlsx`, financeSheets(data));
}

export async function exportTasksData(format: ExportFormat) {
  const tasks = await tasksApi.getTasks().then((r) => r.data).catch(() => []);
  const rows = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    deadline: t.deadline,
    project_id: t.project_id,
  }));
  const ts = stamp();
  if (format === 'csv') {
    downloadCsv(`tasks-export-${ts}.csv`, rows);
    return;
  }
  downloadExcel(`tasks-export-${ts}.xlsx`, { Tasks: rows });
}

export async function exportHabitsData(format: ExportFormat) {
  const habits = await tasksApi.getHabits().then((r) => r.data).catch(() => []);
  const rows = habits.map((h) => ({
    id: h.id,
    title: h.title,
    description: h.description,
    frequency: h.frequency,
    streak: h.streak,
    color: h.color,
  }));
  const ts = stamp();
  if (format === 'csv') {
    downloadCsv(`habits-export-${ts}.csv`, rows);
    return;
  }
  downloadExcel(`habits-export-${ts}.xlsx`, { Habits: rows });
}
