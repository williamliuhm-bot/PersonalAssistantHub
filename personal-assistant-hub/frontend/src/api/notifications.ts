import client from './client';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export const notificationsApi = {
  list: () =>
    client.get<Notification[]>('/notification/api/notifications'),

  markRead: (id: string) =>
    client.patch(`/notification/api/notifications/${id}/read`),

  markAllRead: () =>
    client.post('/notification/api/notifications/mark-all-read'),

  delete: (id: string) =>
    client.delete(`/notification/api/notifications/${id}`),
};
