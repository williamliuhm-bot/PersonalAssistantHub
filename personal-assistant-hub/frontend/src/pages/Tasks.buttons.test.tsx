import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Tasks from '../pages/Tasks';
import { renderWithProviders } from '../test/renderWithProviders';
import { DEFAULT_SETTINGS } from '../types/settings';

vi.mock('../api/tasks', () => ({
  tasksApi: {
    getProjects: vi.fn().mockResolvedValue({ data: [] }),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    getTasks: vi.fn().mockResolvedValue({ data: [] }),
    createTask: vi.fn().mockResolvedValue({ data: { id: 1 } }),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  },
}));

vi.mock('../store/settingsStore', () => ({
  useSettings: () => ({
    settings: DEFAULT_SETTINGS,
    updateSettings: vi.fn(),
    resetSettings: vi.fn(),
  }),
}));

describe('Tasks page buttons', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders Добавить button and opens dialog', async () => {
    renderWithProviders(<Tasks />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Добавить' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    expect(await screen.findByRole('button', { name: 'Отмена' })).toBeInTheDocument();
  });
});
