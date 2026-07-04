import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import type { ReactElement, ReactNode } from 'react';
import { vi } from 'vitest';
import { ToastProvider } from '../store/toastStore';

const theme = createTheme();

interface Options extends Omit<RenderOptions, 'wrapper'> {
  route?: string;
}

export function renderWithProviders(ui: ReactElement, { route = '/', ...options }: Options = {}) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ThemeProvider theme={theme}>
        <ToastProvider>
          <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
        </ToastProvider>
      </ThemeProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...options });
}

export function createAuthMock(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: 1, username: 'demo', email: 'demo@example.com' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn().mockResolvedValue(undefined),
    register: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
    checkAuth: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
