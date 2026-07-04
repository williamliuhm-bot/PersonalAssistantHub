import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Finance from '../pages/Finance';
import { renderWithProviders } from '../test/renderWithProviders';

vi.mock('../api/finance', () => ({
  financeApi: {
    getAccounts: vi.fn().mockResolvedValue({ data: [{ id: 1, name: 'Cash', type: 'cash', balance: 1000, currency: 'RUB', created_at: '' }] }),
    getCategories: vi.fn().mockResolvedValue({ data: [{ id: 1, name: 'Food', type: 'expense', color: '#2563EB' }] }),
    getTransactions: vi.fn().mockResolvedValue({ data: [] }),
    getBudgets: vi.fn().mockResolvedValue({ data: [] }),
    getReports: vi.fn().mockResolvedValue({
      data: {
        total_balance: 0,
        monthly_income: 0,
        monthly_expenses: 0,
        monthly_net: 0,
        balances_by_currency: [],
        monthly_by_currency: [],
      },
    }),
    getCategoryBreakdown: vi.fn().mockResolvedValue({ data: [] }),
    getMonthlyTrends: vi.fn().mockResolvedValue({ data: [] }),
    getBalanceHistory: vi.fn().mockResolvedValue({ data: [] }),
    createAccount: vi.fn(),
    createTransaction: vi.fn(),
    createBudget: vi.fn(),
    createCategory: vi.fn(),
    updateAccount: vi.fn(),
    updateTransaction: vi.fn(),
    updateCategory: vi.fn(),
    deleteAccount: vi.fn(),
    deleteBudget: vi.fn(),
    deleteCategory: vi.fn(),
  },
}));

describe('Finance page buttons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function waitLoaded() {
    await waitFor(() => expect(screen.getByText('Финансы')).toBeInTheDocument());
  }

  it('renders period selector', async () => {
    renderWithProviders(<Finance />);
    await waitLoaded();
    expect(screen.getByText('Период статистики')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('opens add account dialog', async () => {
    renderWithProviders(<Finance />);
    await waitLoaded();
    await userEvent.click(screen.getByRole('button', { name: 'Добавить счёт' }));
    expect(await screen.findByRole('button', { name: 'Сохранить' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));
  });

  it('opens add transaction dialog', async () => {
    renderWithProviders(<Finance />);
    await waitLoaded();
    await userEvent.click(screen.getByRole('tab', { name: 'Транзакции' }));
    await userEvent.click(screen.getByRole('button', { name: /^добавить$/i }));
    expect(await screen.findByRole('button', { name: 'Сохранить' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));
  });

  it('opens categories dialog', async () => {
    renderWithProviders(<Finance />);
    await waitLoaded();
    await userEvent.click(screen.getByRole('tab', { name: 'Транзакции' }));
    await userEvent.click(screen.getByRole('button', { name: 'Категории' }));
    expect(await screen.findByRole('button', { name: 'Закрыть' })).toBeInTheDocument();
  });

  it('opens add budget dialog', async () => {
    renderWithProviders(<Finance />);
    await waitLoaded();
    await userEvent.click(screen.getByRole('tab', { name: 'Бюджеты' }));
    await userEvent.click(screen.getByRole('button', { name: 'Добавить бюджет' }));
    expect(await screen.findByRole('button', { name: 'Сохранить' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));
  });

  it('switches stats period to quarter via select', async () => {
    renderWithProviders(<Finance />);
    await waitLoaded();
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: '3 месяца' }));
    expect(screen.getByRole('combobox')).toHaveTextContent('3 месяца');
  });
});
