import client from './client';

export interface WebAppAuthResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  telegram_user?: {
    id: number;
    first_name?: string;
    username?: string;
  } | null;
}

export const telegramWebAppApi = {
  auth: (init_data: string) =>
    client
      .post<WebAppAuthResponse>('/notification/api/telegram/webapp/auth', { init_data })
      .then((r) => r.data),
};
