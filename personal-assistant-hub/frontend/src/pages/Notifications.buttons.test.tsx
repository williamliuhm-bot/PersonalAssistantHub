import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationsPage from '../pages/Notifications';
import { renderWithProviders } from '../test/renderWithProviders';

vi.mock('../api/notifications', () => ({
  notificationsApi: {
    list: vi.fn().mockResolvedValue({
      data: [
        { id: '1', title: 'Test', message: 'Hello', type: 'info', is_read: false, created_at: new Date().toISOString() },
      ],
    }),
    markRead: vi.fn().mockResolvedValue({}),
    markAllRead: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

describe('Notifications page buttons', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders Прочитать все when unread exist', async () => {
    renderWithProviders(<NotificationsPage />);
    expect(await screen.findByRole('button', { name: 'Прочитать все' })).toBeInTheDocument();
  });

  it('mark all read calls API', async () => {
    renderWithProviders(<NotificationsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Прочитать все' }));
    const { notificationsApi } = await import('../api/notifications');
    expect(notificationsApi.markAllRead).toHaveBeenCalled();
  });

  it('delete notification calls API', async () => {
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => screen.getByText('Test'));
    const deleteButtons = screen.getAllByRole('button');
    const deleteBtn = deleteButtons[deleteButtons.length - 1];
    await userEvent.click(deleteBtn);
    const { notificationsApi } = await import('../api/notifications');
    expect(notificationsApi.delete).toHaveBeenCalledWith('1');
  });
});
