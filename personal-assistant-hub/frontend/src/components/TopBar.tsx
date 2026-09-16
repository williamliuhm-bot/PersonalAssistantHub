import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Badge,
  Box,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  DarkModeOutlined,
  LightModeOutlined,
  Menu as MenuIcon,
  NotificationsOutlined,
  Search,
} from '@mui/icons-material';
import { useAuth } from '../store/authStore';
import { useSettings } from '../store/settingsStore';
import { useTranslation } from '../i18n/useTranslation';

interface TopBarProps {
  onMenuClick?: () => void;
  showMenu?: boolean;
}

export default function TopBar({ onMenuClick, showMenu }: TopBarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { language, setLanguage } = useTranslation();
  const { settings, updateSettings } = useSettings();

  const initials = (user?.username || user?.email || 'U').slice(0, 1).toUpperCase();
  const isDark = settings.theme === 'dark';

  const toggleTheme = () => {
    updateSettings({ theme: isDark ? 'light' : 'dark' });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1, md: 2 },
        px: { xs: 1.5, md: 3 },
        py: 1.5,
        mb: 1,
      }}
    >
      {showMenu ? (
        <IconButton onClick={onMenuClick} sx={{ bgcolor: 'background.paper' }}>
          <MenuIcon />
        </IconButton>
      ) : null}

      <Typography
        variant="h6"
        sx={{
          fontWeight: 800,
          letterSpacing: '-0.03em',
          display: { xs: 'none', sm: 'block' },
          minWidth: 'fit-content',
        }}
      >
        Hub
      </Typography>

      <TextField
        size="small"
        placeholder="Поиск..."
        sx={{
          flex: 1,
          maxWidth: 420,
          mx: { xs: 0, md: 'auto' },
          '& .MuiOutlinedInput-root': {
            borderRadius: 999,
            bgcolor: 'background.paper',
            px: 0.5,
          },
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search sx={{ color: 'text.secondary', fontSize: 20 }} />
            </InputAdornment>
          ),
        }}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
        <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
          <IconButton
            size="small"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            sx={{ bgcolor: 'background.paper' }}
          >
            {isDark ? <LightModeOutlined /> : <DarkModeOutlined />}
          </IconButton>
        </Tooltip>

        <Tooltip title={language === 'ru' ? 'English' : 'Русский'}>
          <IconButton
            size="small"
            onClick={() => setLanguage(language === 'ru' ? 'en' : 'ru')}
            sx={{
              bgcolor: 'background.paper',
              px: 1.25,
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              width: 'auto',
            }}
          >
            {language.toUpperCase()}
          </IconButton>
        </Tooltip>

        <IconButton
          onClick={() => navigate('/notifications')}
          sx={{ bgcolor: 'background.paper' }}
        >
          <Badge color="error" variant="dot" overlap="circular">
            <NotificationsOutlined />
          </Badge>
        </IconButton>

        <Tooltip title={user?.email || ''}>
          <Avatar
            onClick={() => navigate('/settings')}
            sx={{
              width: 40,
              height: 40,
              cursor: 'pointer',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              fontWeight: 700,
              fontSize: 14,
              ml: 0.5,
            }}
          >
            {initials}
          </Avatar>
        </Tooltip>
      </Box>
    </Box>
  );
}
