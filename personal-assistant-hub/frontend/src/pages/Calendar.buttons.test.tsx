import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Calendar from '../pages/Calendar';
import { renderWithProviders } from '../test/renderWithProviders';

vi.mock('../api/tasks', () => ({
  tasksApi: {
    getTasks: vi.fn().mockResolvedValue({ data: [] }),
    getHabits: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

describe('Calendar page buttons', () => {
  it('renders month navigation and today button', async () => {
    renderWithProviders(<Calendar />);
    await waitFor(() => expect(screen.getByText('Календарь')).toBeInTheDocument());
    expect(screen.getByTestId('ChevronLeftIcon')).toBeInTheDocument();
    expect(screen.getByTestId('ChevronRightIcon')).toBeInTheDocument();
    expect(screen.getByTestId('TodayIcon')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(2);
  });

  it('click today button works', async () => {
    renderWithProviders(<Calendar />);
    await waitFor(() => screen.getByTestId('TodayIcon'));
    const todayBtn = screen.getByTestId('TodayIcon').closest('button');
    if (todayBtn) await userEvent.click(todayBtn);
  });
});
