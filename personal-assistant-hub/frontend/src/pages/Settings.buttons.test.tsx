import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Settings from '../pages/Settings';
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

describe('Settings page buttons', () => {
  beforeEach(() => {
    navigate.mockClear();
    authMock.logout.mockClear();
  });

  it('renders logout button', () => {
    renderWithProviders(<Settings />);
    expect(screen.getByRole('button', { name: /выйти из аккаунта/i })).toBeInTheDocument();
  });

  it('logout navigates to login', async () => {
    renderWithProviders(<Settings />);
    await userEvent.click(screen.getByRole('button', { name: /выйти из аккаунта/i }));
    expect(authMock.logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('shows user profile info', async () => {
    renderWithProviders(<Settings />);
    await waitFor(() => {
      expect(screen.getByText('demo@example.com')).toBeInTheDocument();
    });
  });
});
