import client from './client';

export interface Account {
  id: number;
  name: string;
  type: string;
  balance: number;
  currency: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
}

export interface Transaction {
  id: number;
  user_id: number;
  account_id: number;
  account_name?: string;
  account_currency?: string;
  category_id?: number | null;
  category_name?: string;
  category_color?: string;
  amount: number;
  description: string;
  date: string;
  transaction_type: 'income' | 'expense';
  is_recurring: boolean;
  recurring_day?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Budget {
  id: number;
  user_id: number;
  category_id: number;
  category_name?: string;
  category_color?: string;
  limit_amount: number;
  spent_amount: number;
  period: string;
  period_start?: string;
  period_end?: string;
  progress?: number;
  created_at: string;
  updated_at: string;
}

export interface CurrencyAmount {
  currency: string;
  amount: number;
}

export interface CurrencyMonthlyStats {
  currency: string;
  income: number;
  expenses: number;
  net: number;
}

export interface FinanceReport {
  total_balance: number;
  monthly_income: number;
  monthly_expenses: number;
  monthly_net: number;
  balances_by_currency?: CurrencyAmount[];
  monthly_by_currency?: CurrencyMonthlyStats[];
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

export interface MonthlyTrend {
  month: string;
  income: number;
  expenses: number;
}

export interface BalanceHistoryPoint {
  date: string;
  balance: number;
}

export interface BalanceHistorySeries {
  currency: string;
  points: BalanceHistoryPoint[];
}

export const financeApi = {
  getAccounts: () =>
    client.get<Account[]>('/finance/api/accounts'),

  createAccount: (data: Partial<Account>) =>
    client.post<Account>('/finance/api/accounts', data),

  updateAccount: (id: number, data: Partial<Account>) =>
    client.put<Account>(`/finance/api/accounts/${id}`, data),

  deleteAccount: (id: number) =>
    client.delete(`/finance/api/accounts/${id}`),

  getCategories: () =>
    client.get<Category[]>('/finance/api/categories'),

  createCategory: (data: Partial<Category>) =>
    client.post<Category>('/finance/api/categories', {
      ...data,
      type: data.type,
    }),

  updateCategory: (id: number, data: Partial<Category>) =>
    client.put<Category>(`/finance/api/categories/${id}`, data),

  deleteCategory: (id: number) =>
    client.delete(`/finance/api/categories/${id}`),

  getTransactions: (params?: {
    page?: number;
    per_page?: number;
    account_id?: number;
    category_id?: number;
    date_from?: string;
    date_to?: string;
  }) =>
    client.get<Transaction[]>('/finance/api/transactions', { params: { per_page: 100, ...params } }),

  createTransaction: (data: Partial<Transaction>) =>
    client.post<Transaction>('/finance/api/transactions', data),

  updateTransaction: (id: number, data: Partial<Transaction>) =>
    client.put<Transaction>(`/finance/api/transactions/${id}`, data),

  deleteTransaction: (id: number) =>
    client.delete(`/finance/api/transactions/${id}`),

  getBudgets: (params?: { year?: number; month?: number; months?: number }) =>
    client.get<Budget[]>('/finance/api/budgets', { params }),

  createBudget: (data: Partial<Budget>) =>
    client.post<Budget>('/finance/api/budgets', data),

  updateBudget: (id: number, data: Partial<Budget>) =>
    client.put<Budget>(`/finance/api/budgets/${id}`, data),

  deleteBudget: (id: number) =>
    client.delete(`/finance/api/budgets/${id}`),

  getReports: (params?: { start_date?: string; end_date?: string }) =>
    client.get<FinanceReport>('/finance/api/reports/dashboard', { params }),

  getCategoryBreakdown: (params?: { year?: number; month?: number; days?: number }) =>
    client.get<CategoryBreakdown[]>('/finance/api/reports/category-breakdown', { params }),

  getMonthlyTrends: (months?: number) =>
    client.get<MonthlyTrend[]>('/finance/api/reports/monthly-trends', { params: { months } }),

  getBalanceHistory: (days?: number) =>
    client.get<BalanceHistorySeries[]>('/finance/api/reports/balance-history', { params: { days } }),
};
