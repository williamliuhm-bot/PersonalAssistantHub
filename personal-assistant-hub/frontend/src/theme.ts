import { createTheme } from '@mui/material/styles';

type PaletteMode = 'light' | 'dark';

export const softShadowLight = '0 8px 30px rgba(15, 23, 42, 0.06)';
export const softShadowDark = '0 8px 30px rgba(0, 0, 0, 0.45)';

export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === 'dark';

  return createTheme({
    typography: {
      fontFamily: '"Plus Jakarta Sans", "Segoe UI", sans-serif',
      h1: { fontWeight: 700 },
      h2: { fontWeight: 700 },
      h3: { fontWeight: 700 },
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 600 },
      subtitle1: { fontWeight: 600 },
      button: { fontWeight: 600 },
    },
    shape: { borderRadius: 20 },
    palette: {
      mode,
      primary: isDark
        ? { main: '#FFFFFF', light: '#FFFFFF', dark: '#E5E7EB', contrastText: '#000000' }
        : { main: '#111827', light: '#374151', dark: '#030712', contrastText: '#FFFFFF' },
      secondary: { main: '#6366F1', light: '#818CF8', dark: '#4F46E5' },
      success: { main: '#10B981', light: '#34D399', dark: '#059669' },
      warning: { main: '#F59E0B', light: '#FBBF24', dark: '#D97706' },
      error: { main: '#EF4444', light: '#F87171', dark: '#DC2626' },
      info: { main: '#3B82F6', light: '#60A5FA', dark: '#2563EB' },
      background: isDark
        ? { default: '#000000', paper: '#0B0B0B' }
        : { default: '#EEF0F4', paper: '#FFFFFF' },
      divider: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15, 23, 42, 0.06)',
      text: isDark
        ? { primary: '#FFFFFF', secondary: '#B8BEC9' }
        : { primary: '#0F172A', secondary: '#6B7280' },
      action: {
        hover: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.04)',
        selected: isDark ? 'rgba(255,255,255,0.11)' : 'rgba(15,23,42,0.06)',
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: {
            backgroundColor: isDark ? '#000000' : '#EEF0F4',
          },
          body: {
            backgroundColor: isDark ? '#000000' : '#EEF0F4',
            backgroundImage: isDark
              ? 'none'
              : 'radial-gradient(ellipse at top right, rgba(99,102,241,0.06), transparent 45%)',
            backgroundAttachment: 'fixed',
          },
          '#root': {
            minHeight: '100vh',
            backgroundColor: isDark ? '#000000' : '#EEF0F4',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none' as const,
            fontWeight: 600,
            borderRadius: 12,
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          },
          containedPrimary: {
            ...(isDark
              ? {
                  backgroundColor: '#FFFFFF',
                  color: '#000000',
                  '&:hover': { backgroundColor: '#E5E7EB' },
                }
              : {
                  backgroundColor: '#111827',
                  '&:hover': { backgroundColor: '#030712' },
                }),
          },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderRadius: 24,
            border: 'none',
            boxShadow: isDark ? softShadowDark : softShadowLight,
          },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderRadius: 20,
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 14,
              backgroundColor: isDark ? '#101010' : 'rgba(15,23,42,0.03)',
              '& fieldset': { borderColor: 'transparent' },
              '&:hover fieldset': {
                borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.1)',
              },
              '&.Mui-focused fieldset': {
                borderColor: isDark ? '#FFFFFF' : '#111827',
                borderWidth: 1.5,
              },
            },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            borderRadius: 24,
            boxShadow: isDark ? softShadowDark : softShadowLight,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 10, fontWeight: 500 },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none' as const,
            fontWeight: 600,
            minHeight: 40,
            borderRadius: 10,
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: { display: 'none' },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { borderRadius: 12 },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            border: 'none',
            backgroundImage: 'none',
          },
        },
      },
    },
  });
}

const theme = createAppTheme('dark');
export default theme;
