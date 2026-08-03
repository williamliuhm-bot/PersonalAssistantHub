import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer,
  Box,
  IconButton,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  DashboardOutlined,
  AccountBalanceWalletOutlined,
  BarChartOutlined,
  AssignmentOutlined,
  CalendarMonthOutlined,
  WhatshotOutlined,
  NotificationsOutlined,
  SettingsOutlined,
  AdminPanelSettingsOutlined,
  LogoutOutlined,
  Close,
} from '@mui/icons-material';
import { useAuth } from '../store/authStore';
import { isAdmin } from '../api/auth';
import { useTranslation } from '../i18n/useTranslation';
import type { TranslationKey } from '../i18n/translations';
import { softShadowDark, softShadowLight } from '../theme';

export const SIDEBAR_WIDTH = 84;

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const navItems: { labelKey: TranslationKey; icon: React.ReactNode; path: string }[] = [
  { labelKey: 'nav.dashboard', icon: <DashboardOutlined />, path: '/dashboard' },
  { labelKey: 'nav.finance', icon: <AccountBalanceWalletOutlined />, path: '/finance' },
  { labelKey: 'nav.analytics', icon: <BarChartOutlined />, path: '/analytics' },
  { labelKey: 'nav.tasks', icon: <AssignmentOutlined />, path: '/tasks' },
  { labelKey: 'nav.calendar', icon: <CalendarMonthOutlined />, path: '/calendar' },
  { labelKey: 'nav.habits', icon: <WhatshotOutlined />, path: '/habits' },
  { labelKey: 'nav.notifications', icon: <NotificationsOutlined />, path: '/notifications' },
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

  const NavButton = ({
    path,
    icon,
    label,
  }: {
    path: string;
    icon: React.ReactNode;
    label: string;
  }) => {
    const isActive = location.pathname === path || location.pathname.startsWith(`${path}/`);
    return (
      <Tooltip title={label} placement="right">
        <IconButton
          onClick={() => handleNavigate(path)}
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2.5,
            color: isActive ? 'primary.contrastText' : 'text.secondary',
            bgcolor: isActive ? 'primary.main' : 'transparent',
            '&:hover': {
              bgcolor: isActive ? 'primary.main' : 'action.hover',
            },
          }}
        >
          {icon}
        </IconButton>
      </Tooltip>
    );
  };

  const content = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        height: '100%',
        py: 2,
        gap: 1,
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: 2.5,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 18,
          mb: 1.5,
        }}
      >
        H
      </Box>

      {isMobile && (
        <IconButton onClick={onClose} sx={{ mb: 1 }}>
          <Close />
        </IconButton>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, flex: 1 }}>
        {navItems.map((item) => (
          <NavButton
            key={item.path}
            path={item.path}
            icon={item.icon}
            label={t(item.labelKey)}
          />
        ))}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 'auto' }}>
        {isAdmin(user) && (
          <NavButton
            path="/admin/users"
            icon={<AdminPanelSettingsOutlined />}
            label={t('nav.admin')}
          />
        )}
        <NavButton path="/settings" icon={<SettingsOutlined />} label={t('nav.settings')} />
        <Tooltip title={t('nav.logout')} placement="right">
          <IconButton
            onClick={logout}
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2.5,
              color: 'error.main',
              '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' },
            }}
          >
            <LogoutOutlined />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  const paperSx = {
    width: SIDEBAR_WIDTH,
    bgcolor: 'background.paper',
    border: 'none',
    boxShadow: theme.palette.mode === 'dark' ? softShadowDark : softShadowLight,
    m: { xs: 0, md: 1.5 },
    height: { xs: '100%', md: 'calc(100% - 24px)' },
    borderRadius: { xs: 0, md: 4 },
  };

  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={open}
        onClose={onClose}
        sx={{ '& .MuiDrawer-paper': paperSx }}
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
        width: SIDEBAR_WIDTH + 24,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          ...paperSx,
          position: 'relative',
        },
      }}
    >
      {content}
    </Drawer>
  );
}
