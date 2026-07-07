import { useMemo, type ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import useMediaQuery from '@mui/material/useMediaQuery';
import { createAppTheme } from '../theme';
import { useSettings } from '../store/settingsStore';

export default function AppThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');

  const mode = settings.theme === 'system' ? (prefersDark ? 'dark' : 'light') : settings.theme;

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
