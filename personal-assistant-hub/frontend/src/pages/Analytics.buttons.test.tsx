import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Analytics from '../pages/Analytics';
import { renderWithProviders } from '../test/renderWithProviders';

vi.mock('../api/finance', () => ({
  financeApi: {
    getAccounts: vi.fn().mockResolvedValue({ data: [] }),
    getTransactions: vi.fn().mockResolvedValue({ data: [] }),
    getReports: vi.fn().mockResolvedValue({
      data: { total_balance: 0, monthly_income: 0, monthly_expenses: 0, monthly_net: 0 },
    }),
    getBalanceHistory: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock('../api/analytics', () => ({
  analyticsApi: {
    getProductivityReports: vi.fn().mockResolvedValue({ data: [] }),
    getCorrelation: vi.fn().mockResolvedValue({
      data: { dates: [], tasks_completed: [], expenses: [], correlation_score: 0 },
    }),
    getInsights: vi.fn().mockResolvedValue({ data: { insight: '' } }),
  },
}));

describe('Analytics page buttons', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders Показать button and date presets', async () => {
    renderWithProviders(<Analytics />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Показать' })).toBeInTheDocument());
    expect(screen.getByText('Текущий месяц')).toBeInTheDocument();
    expect(screen.getByText('Прошлый месяц')).toBeInTheDocument();
  });

  it('clicks Показать to apply range', async () => {
    renderWithProviders(<Analytics />);
    await waitFor(() => screen.getByRole('button', { name: 'Показать' }));
    await userEvent.click(screen.getByRole('button', { name: 'Показать' }));
    const { financeApi } = await import('../api/finance');
    expect(financeApi.getTransactions).toHaveBeenCalled();
  });

  it('preset Текущий месяц updates range', async () => {
    renderWithProviders(<Analytics />);
    await waitFor(() => screen.getByText('Текущий месяц'));
    await userEvent.click(screen.getByText('Текущий месяц'));
    await userEvent.click(screen.getByRole('button', { name: 'Показать' }));
    const { financeApi } = await import('../api/finance');
    expect(financeApi.getTransactions).toHaveBeenCalled();
  });
});
