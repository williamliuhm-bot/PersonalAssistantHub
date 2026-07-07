import { useCallback } from 'react';
import { useSettings } from '../store/settingsStore';
import { translate, type TranslationKey } from './translations';

export function useTranslation() {
  const { settings } = useSettings();

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) =>
      translate(settings.language, key, vars),
    [settings.language],
  );

  return { t, language: settings.language };
}
