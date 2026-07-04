import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Habits from '../pages/Habits';
import { renderWithProviders } from '../test/renderWithProviders';

vi.mock('../api/tasks', () => ({
  tasksApi: {
    getHabits: vi.fn().mockResolvedValue({
      data: [{ id: 1, title: 'Water', frequency: 'daily', color: '#2563EB', streak: 0, description: '' }],
    }),
    getHabitCalendar: vi.fn().mockResolvedValue({
      data: { habit_id: 1, year: 2026, month: 7, days: [{ date: '2026-07-03', completed: true }] },
    }),
    createHabit: vi.fn(),
    updateHabit: vi.fn(),
    completeHabit: vi.fn(),
  },
}));

describe('Habits page buttons', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders list tab with habit card', async () => {
    renderWithProviders(<Habits />);
    await waitFor(() => expect(screen.getByText('Water')).toBeInTheDocument());
    expect(screen.getByRole('tab', { name: 'Список' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Календарь' })).toBeInTheDocument();
  });

  it('opens add dialog', async () => {
    renderWithProviders(<Habits />);
    await waitFor(() => screen.getByText('Water'));
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    expect(await screen.findByRole('button', { name: 'Создать' })).toBeInTheDocument();
  });

  it('complete habit button calls API', async () => {
    renderWithProviders(<Habits />);
    await waitFor(() => screen.getByText('Water'));
    await userEvent.click(screen.getByRole('button', { name: 'Отметить' }));
    const { tasksApi } = await import('../api/tasks');
    expect(tasksApi.completeHabit).toHaveBeenCalledWith(1);
  });

  it('calendar tab loads habit calendar', async () => {
    renderWithProviders(<Habits />);
    await waitFor(() => screen.getByText('Water'));
    await userEvent.click(screen.getByRole('tab', { name: 'Календарь' }));
    const { tasksApi } = await import('../api/tasks');
    await waitFor(() => expect(tasksApi.getHabitCalendar).toHaveBeenCalled());
  });
});
