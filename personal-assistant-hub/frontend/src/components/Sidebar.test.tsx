import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from '../components/Sidebar';
import { renderWithProviders, createAuthMock } from '../test/renderWithProviders';

const navigate = vi.fn();
const authMock = createAuthMock();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('../store/authStore', () => ({
  useAuth: () => authMock,
}));

describe('Sidebar navigation buttons', () => {
  beforeEach(() => {
    navigate.mockClear();
  });

  const navLabels = [
    'Dashboard',
    'Финансы',
    'Отчеты',
    'Задачи',
    'Календарь',
    'Привычки',
    'Уведомления',
    'Настройки',
    'Выйти',
  ];

  it.each(navLabels)('renders and clicks "%s"', async (label) => {
    renderWithProviders(<Sidebar open onClose={() => {}} />, { route: '/dashboard' });
    const item = screen.getByText(label);
    expect(item).toBeInTheDocument();
    await userEvent.click(item);
    if (label === 'Выйти') {
      expect(authMock.logout).toHaveBeenCalled();
    } else {
      expect(navigate).toHaveBeenCalled();
    }
  });
});
