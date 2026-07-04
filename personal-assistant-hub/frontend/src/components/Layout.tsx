import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Box, IconButton, useMediaQuery, useTheme } from '@mui/material';
import { Menu } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/finance': 'Финансы',
  '/tasks': 'Задачи',
  '/calendar': 'Календарь',
  '/habits': 'Привычки',
  '/analytics': 'Отчеты',
  '/notifications': 'Уведомления',
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {isMobile && (
          <Box sx={{ p: 1 }}>
            <IconButton onClick={() => setSidebarOpen(true)}>
              <Menu />
            </IconButton>
          </Box>
        )}

        <Box
          sx={{
            flex: 1,
            p: { xs: 2, md: 3 },
            width: '100%',
            maxWidth: 1320,
            mx: 'auto',
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              style={{ width: '100%' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </Box>
      </Box>
    </Box>
  );
}
