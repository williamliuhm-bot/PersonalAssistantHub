import client from './client';

export type UserRole = 'user' | 'admin';

export type SubscriptionStatus =
  | 'free'
  | 'trial'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface User {
  id: number;
  email: string;
  username: string;
  role: UserRole;
  is_active: boolean;
  subscription_status: SubscriptionStatus;
  subscription_plan: string | null;
  subscription_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserListResponse {
  items: User[];
  total: number;
}

export interface AdminUserUpdate {
  is_active?: boolean;
  role?: UserRole;
  subscription_status?: SubscriptionStatus;
  subscription_plan?: string | null;
  subscription_expires_at?: string | null;
}

export interface ListUsersParams {
  skip?: number;
  limit?: number;
  search?: string;
  subscription_status?: SubscriptionStatus;
}

export const authApi = {
  login: (data: LoginRequest) =>
    client.post<AuthResponse>('/auth/login', { email: data.email, password: data.password }),

  register: (data: RegisterRequest) =>
    client.post<AuthResponse>('/auth/register', {
      email: data.email,
      username: data.username,
      password: data.password,
    }),

  refresh: (refreshToken: string) =>
    client.post<{ access_token: string }>('/auth/refresh', { refresh_token: refreshToken }),

  logout: (token: string) =>
    client.post('/auth/logout', { token }),

  getMe: () =>
    client.get<User>('/auth/me'),

  listUsers: (params?: ListUsersParams) =>
    client.get<UserListResponse>('/auth/users', { params }),

  updateUser: (userId: number, data: AdminUserUpdate) =>
    client.patch<User>(`/auth/users/${userId}`, data),
};

export function isAdmin(user: User | null): boolean {
  return user?.role === 'admin';
}
