import client from './client';

export interface TelegramStatus {
  linked: boolean;
  chat_id_masked?: string | null;
  default_account_id?: number | null;
  bot_username?: string | null;
  bot_url?: string | null;
}

export interface TelegramLinkToken {
  token: string;
  deep_link: string;
  expires_at: string;
}

export const telegramApi = {
  getStatus: () =>
    client.get<TelegramStatus>('/notification/api/telegram/status').then((r) => r.data),

  createLinkToken: () =>
    client
      .post<TelegramLinkToken>('/notification/api/telegram/link-token')
      .then((r) => r.data),

  updateSettings: (default_account_id: number | null) =>
    client
      .put<TelegramStatus>('/notification/api/telegram/settings', { default_account_id })
      .then((r) => r.data),

  unlink: () => client.delete('/notification/api/telegram/link'),
};
