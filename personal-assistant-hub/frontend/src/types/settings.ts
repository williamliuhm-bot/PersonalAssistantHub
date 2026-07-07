export type ThemeMode = 'light' | 'dark' | 'system';
export type Language = 'ru' | 'en';
export type StartScreen =
  | 'dashboard'
  | 'finance'
  | 'tasks'
  | 'habits'
  | 'calendar'
  | 'analytics';
export type PrimaryCurrency = 'RUB' | 'USD' | 'EUR' | 'GBP';
export type BalanceMode = 'actual' | 'budget';
export type CompletedTasksBehavior = 'hide' | 'keep';
export type WeekStartDay = 0 | 1 | 6;

export interface ModuleNotifications {
  push: boolean;
  email: boolean;
}

export interface UserSettings {
  theme: ThemeMode;
  language: Language;
  startScreen: StartScreen;

  primaryCurrency: PrimaryCurrency;
  financialMonthStart: number;
  balanceMode: BalanceMode;
  expenseReminderEnabled: boolean;
  expenseReminderTime: string;
  dashboardShowBalance: boolean;
  dashboardShowBudgets: boolean;
  dashboardShowTransactions: boolean;

  workHoursStart: string;
  workHoursEnd: string;
  weekStartDay: WeekStartDay;
  defaultTaskDuration: number;
  defaultTaskTime: string;
  defaultReminderMinutes: number;
  completedTasksBehavior: CompletedTasksBehavior;

  dayStartHour: number;
  habitsReminderTime: string;
  habitsSkipWeekends: boolean;
  habitsAutoHideCompleted: boolean;

  notifyFinance: ModuleNotifications & { budgetExceeded: boolean };
  notifyTasks: ModuleNotifications & { deadline: boolean };
  notifyHabits: ModuleNotifications & { daily: boolean };
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'dark',
  language: 'ru',
  startScreen: 'dashboard',

  primaryCurrency: 'RUB',
  financialMonthStart: 1,
  balanceMode: 'actual',
  expenseReminderEnabled: false,
  expenseReminderTime: '20:00',
  dashboardShowBalance: true,
  dashboardShowBudgets: true,
  dashboardShowTransactions: true,

  workHoursStart: '09:00',
  workHoursEnd: '18:00',
  weekStartDay: 1,
  defaultTaskDuration: 60,
  defaultTaskTime: '10:00',
  defaultReminderMinutes: 30,
  completedTasksBehavior: 'keep',

  dayStartHour: 4,
  habitsReminderTime: '08:00',
  habitsSkipWeekends: false,
  habitsAutoHideCompleted: false,

  notifyFinance: { push: true, email: false, budgetExceeded: true },
  notifyTasks: { push: true, email: false, deadline: true },
  notifyHabits: { push: true, email: false, daily: true },
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
};

export const START_SCREEN_OPTIONS: { value: StartScreen; label: string }[] = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'finance', label: 'Финансы' },
  { value: 'tasks', label: 'Задачи' },
  { value: 'habits', label: 'Привычки' },
  { value: 'calendar', label: 'Календарь' },
  { value: 'analytics', label: 'Аналитика' },
];

export function getStartScreenPath(screen: StartScreen): string {
  return screen === 'dashboard' ? '/dashboard' : `/${screen}`;
}

export function settingsStorageKey(userId: number): string {
  return `pah_settings_${userId}`;
}

export function loadSettings(userId: number | null): UserSettings {
  if (!userId) return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(settingsStorageKey(userId));
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(userId: number, settings: UserSettings): void {
  localStorage.setItem(settingsStorageKey(userId), JSON.stringify(settings));
}
