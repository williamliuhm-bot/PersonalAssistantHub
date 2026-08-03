import { useCallback } from 'react';
import { useSettings } from '../store/settingsStore';
import { translate, type TranslationKey } from './translations';
import type { Language } from '../types/settings';

export function useTranslation() {
  const { settings, updateSettings } = useSettings();

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) =>
      translate(settings.language, key, vars),
    [settings.language],
  );

  const setLanguage = useCallback(
    (language: Language) => updateSettings({ language }),
    [updateSettings],
  );

  return { t, language: settings.language, setLanguage };
}
