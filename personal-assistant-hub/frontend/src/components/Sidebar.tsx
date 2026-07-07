import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Box,
  Typography,
  Divider,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Dashboard,
  AccountBalance,
  BarChart,
  Assignment,
  CalendarToday,
  Whatshot,
  Notifications,
  Settings,
  ChevronLeft,
  AdminPanelSettings,
} from '@mui/icons-material';
import { useAuth } from '../store/authStore';
import { isAdmin } from '../api/auth';
import { useTranslation } from '../i18n/useTranslation';
import type { TranslationKey } from '../i18n/translations';

const DRAWER_WIDTH = 260;

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const navItems: { labelKey: TranslationKey; icon: React.ReactNode; path: string }[] = [
  { labelKey: 'nav.dashboard', icon: <Dashboard />, path: '/dashboard' },
  { labelKey: 'nav.finance', icon: <AccountBalance />, path: '/finance' },
  { labelKey: 'nav.analytics', icon: <BarChart />, path: '/analytics' },
  { labelKey: 'nav.tasks', icon: <Assignment />, path: '/tasks' },
  { labelKey: 'nav.calendar', icon: <CalendarToday />, path: '/calendar' },
  { labelKey: 'nav.habits', icon: <Whatshot />, path: '/habits' },
  { labelKey: 'nav.notifications', icon: <Notifications />, path: '/notifications' },
];

export default function Sidebar({ open, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { logout, user } = useAuth();
  const { t } = useTranslation();

  const handleNavigate = (path: string) => {
    navigate(path);
    if (isMobile) onClose();
  };

  const content = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 700,
              color: '#fff',
            }}
          >
            P
          </Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>
            Assistant Hub
          </Typography>
        </Box>
        {isMobile && (
          <IconButton onClick={onClose} size="small">
            <ChevronLeft />
          </IconButton>
        )}
      </Box>

      <Divider sx={{ mx: 2 }} />

      <List sx={{ flex: 1, px: 1, py: 1 }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItemButton
              key={item.path}
              onClick={() => handleNavigate(item.path)}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                color: isActive ? 'primary.main' : 'text.secondary',
                bgcolor: isActive ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                '&:hover': {
                  bgcolor: isActive ? 'rgba(37, 99, 235, 0.15)' : 'rgba(148, 163, 184, 0.08)',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: isActive ? 'primary.main' : 'text.secondary',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={t(item.labelKey)}
                primaryTypographyProps={{
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Divider sx={{ mx: 2 }} />

      <List sx={{ px: 1, py: 1 }}>
        {isAdmin(user) && (
          <ListItemButton
            onClick={() => handleNavigate('/admin/users')}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              color: location.pathname === '/admin/users' ? 'primary.main' : 'text.secondary',
              bgcolor: location.pathname === '/admin/users' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
              '&:hover': {
                bgcolor: location.pathname === '/admin/users' ? 'rgba(37, 99, 235, 0.15)' : 'rgba(148, 163, 184, 0.08)',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>
              <AdminPanelSettings />
            </ListItemIcon>
            <ListItemText primary={t('nav.admin')} primaryTypographyProps={{ fontSize: 14 }} />
          </ListItemButton>
        )}
        <ListItemButton
          onClick={() => handleNavigate('/settings')}
          sx={{
            borderRadius: 2,
            color: location.pathname === '/settings' ? 'primary.main' : 'text.secondary',
            bgcolor: location.pathname === '/settings' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
            '&:hover': { bgcolor: location.pathname === '/settings' ? 'rgba(37, 99, 235, 0.15)' : 'rgba(148, 163, 184, 0.08)' },
          }}
        >
          <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>
            <Settings />
          </ListItemIcon>
          <ListItemText primary={t('nav.settings')} primaryTypographyProps={{ fontSize: 14 }} />
        </ListItemButton>
        <ListItemButton
          onClick={logout}
          sx={{ borderRadius: 2, color: 'error.main', '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.08)' } }}
        >
          <ListItemText primary={t('nav.logout')} primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }} sx={{ textAlign: 'center' }} />
        </ListItemButton>
      </List>
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={open}
        onClose={onClose}
        sx={{
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            bgcolor: 'background.paper',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        {content}
      </Drawer>
    );
  }

  return (
    <Drawer
      variant="permanent"
      open
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          bgcolor: 'background.paper',
          borderRight: '1px solid',
          borderColor: 'divider',
        },
      }}
    >
      {content}
    </Drawer>
  );
}
