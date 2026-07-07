import { createTheme, type PaletteMode } from '@mui/material/styles';

const shared = {
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none' as const, fontWeight: 600, borderRadius: 8 },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { backgroundImage: 'none', borderRadius: 12 },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiTextField: {
      styleOverrides: { root: { '& .MuiOutlinedInput-root': { borderRadius: 8 } } },
    },
    MuiDialog: {
      styleOverrides: { paper: { backgroundImage: 'none', borderRadius: 16 } },
    },
    MuiChip: { styleOverrides: { root: { borderRadius: 6 } } },
    MuiTab: {
      styleOverrides: { root: { textTransform: 'none' as const, fontWeight: 600 } },
    },
  },
};

export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === 'dark';
  return createTheme({
    ...shared,
    palette: {
      mode,
      primary: { main: '#2563EB', light: '#60A5FA', dark: '#1D4ED8' },
      success: { main: '#10B981', light: '#34D399', dark: '#059669' },
      warning: { main: '#F59E0B', light: '#FBBF24', dark: '#D97706' },
      error: { main: '#EF4444', light: '#F87171', dark: '#DC2626' },
      background: isDark
        ? { default: '#0F172A', paper: '#1E293B' }
        : { default: '#F8FAFC', paper: '#FFFFFF' },
      divider: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.08)',
      text: isDark
        ? { primary: '#F1F5F9', secondary: '#94A3B8' }
        : { primary: '#0F172A', secondary: '#64748B' },
    },
    components: {
      ...shared.components,
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderRadius: 12,
            border: isDark
              ? '1px solid rgba(148, 163, 184, 0.12)'
              : '1px solid rgba(15, 23, 42, 0.08)',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottomColor: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.08)',
          },
        },
      },
    },
  });
}

const theme = createAppTheme('dark');
export default theme;
