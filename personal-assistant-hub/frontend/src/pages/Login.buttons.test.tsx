import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from '../pages/Login';
import { renderWithProviders, createAuthMock } from '../test/renderWithProviders';

const navigate = vi.fn();
const authMock = createAuthMock({ isAuthenticated: false });

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('../store/authStore', () => ({
  useAuth: () => authMock,
}));

vi.mock('../store/settingsStore', () => ({
  useSettings: () => ({
    settings: {
      theme: 'light',
      language: 'ru',
      startScreen: 'dashboard',
      primaryCurrency: 'RUB',
    },
    updateSettings: vi.fn(),
    resetSettings: vi.fn(),
  }),
}));

describe('Login page buttons', () => {
  beforeEach(() => {
    navigate.mockClear();
    authMock.login.mockClear();
    authMock.register.mockClear();
  });

  it('renders Войти button on login tab', () => {
    renderWithProviders(<Login />);
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
  });

  it('shows validation error when login fields empty', async () => {
    renderWithProviders(<Login />);
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    expect(await screen.findByText('Заполните все поля')).toBeInTheDocument();
  });

  it('calls login on submit', async () => {
    renderWithProviders(<Login />);
    await userEvent.type(screen.getByLabelText('Email или имя пользователя'), 'demo@example.com');
    await userEvent.type(screen.getByLabelText('Пароль'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    await waitFor(() => expect(authMock.login).toHaveBeenCalled());
  });

  it('switches to register tab and shows Зарегистрироваться', async () => {
    renderWithProviders(<Login />);
    await userEvent.click(screen.getByText('Регистрация'));
    expect(screen.getByRole('button', { name: 'Зарегистрироваться' })).toBeInTheDocument();
  });

  it('toggles password visibility', async () => {
    renderWithProviders(<Login />);
    const password = screen.getByLabelText('Пароль') as HTMLInputElement;
    expect(password.type).toBe('password');
    const toggleButtons = screen.getAllByRole('button').filter((b) => !b.textContent?.includes('Войти'));
    await userEvent.click(toggleButtons[0]);
    expect((screen.getByLabelText(/^пароль$/i) as HTMLInputElement).type).toBe('text');
  });
});
