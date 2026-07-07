import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type UserSettings,
} from '../types/settings';
import { useAuth } from './authStore';

interface SettingsContextValue {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [settings, setSettings] = useState<UserSettings>(() => loadSettings(userId));

  useEffect(() => {
    setSettings(loadSettings(userId));
  }, [userId]);

  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  const updateSettings = useCallback(
    (patch: Partial<UserSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        if (userId) saveSettings(userId, next);
        return next;
      });
    },
    [userId],
  );

  const resetSettings = useCallback(() => {
    const next = { ...DEFAULT_SETTINGS };
    setSettings(next);
    if (userId) saveSettings(userId, next);
  }, [userId]);

  const value = useMemo(
    () => ({ settings, updateSettings, resetSettings }),
    [settings, updateSettings, resetSettings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}
