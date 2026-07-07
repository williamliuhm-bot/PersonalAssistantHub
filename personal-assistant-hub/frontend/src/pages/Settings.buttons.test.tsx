import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Settings from '../pages/Settings';
import { renderWithProviders, createAuthMock } from '../test/renderWithProviders';

const navigate = vi.fn();
const authMock = createAuthMock();
const updateSettings = vi.fn();
const resetSettings = vi.fn();
const showSuccess = vi.fn();
const showError = vi.fn();
const showInfo = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('../store/authStore', () => ({
  useAuth: () => authMock,
}));

vi.mock('../i18n/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    language: 'ru',
  }),
}));

vi.mock('../store/settingsStore', () => ({
  useSettings: () => ({
    settings: {
      theme: 'dark',
      language: 'ru',
      startScreen: 'dashboard',
      primaryCurrency: 'RUB',
      financialMonthStart: 1,
      balanceMode: 'actual',
      expenseReminderEnabled: false,
      expenseReminderTime: '20:00',
      dashboardShowBalance: true,
      dashboardShowBudgets: true,
      dashboardShowTransactions: true,
      workHoursStart: '09:00',
      workHoursEnd: '18:00',
      weekStartDay: 1,
      defaultTaskDuration: 60,
      defaultTaskTime: '10:00',
      defaultReminderMinutes: 30,
      completedTasksBehavior: 'keep',
      dayStartHour: 4,
      habitsReminderTime: '08:00',
      habitsSkipWeekends: false,
      habitsAutoHideCompleted: false,
      notifyFinance: { push: true, email: false, budgetExceeded: true },
      notifyTasks: { push: true, email: false, deadline: true },
      notifyHabits: { push: true, email: false, daily: true },
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    },
    updateSettings,
    resetSettings,
  }),
}));

vi.mock('../store/toastStore', () => ({
  useToast: () => ({ showSuccess, showError, showInfo }),
}));

describe('Settings page buttons', () => {
  beforeEach(() => {
    navigate.mockClear();
    authMock.logout.mockClear();
    updateSettings.mockClear();
    resetSettings.mockClear();
  });

  it('renders logout button', () => {
    renderWithProviders(<Settings />);
    expect(screen.getByRole('button', { name: /settings\.logout/i })).toBeInTheDocument();
  });

  it('logout navigates to login', async () => {
    renderWithProviders(<Settings />);
    await userEvent.click(screen.getByRole('button', { name: /settings\.logout/i }));
    expect(authMock.logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('shows user profile info', async () => {
    renderWithProviders(<Settings />);
    await waitFor(() => {
      expect(screen.getByText('demo@example.com')).toBeInTheDocument();
    });
  });

  it('shows settings sections', () => {
    renderWithProviders(<Settings />);
    expect(screen.getByText('settings.finance')).toBeInTheDocument();
    expect(screen.getByText('settings.tasks')).toBeInTheDocument();
    expect(screen.getByText('settings.habits')).toBeInTheDocument();
    expect(screen.getByText('settings.notifications')).toBeInTheDocument();
    expect(screen.getByText('settings.interface')).toBeInTheDocument();
  });
});
