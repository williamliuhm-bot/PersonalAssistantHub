import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuth } from './store/authStore';
import { useSettings } from './store/settingsStore';
import { getStartScreenPath } from './types/settings';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Finance from './pages/Finance';
import Tasks from './pages/Tasks';
import Calendar from './pages/Calendar';
import Habits from './pages/Habits';
import Analytics from './pages/Analytics';
import Notifications from './pages/Notifications';
import AdminRoute from './components/AdminRoute';
import AdminUsers from './pages/AdminUsers';
import Settings from './pages/Settings';
import TelegramMiniApp from './pages/TelegramMiniApp';

function HomeRedirect() {
  const { settings } = useSettings();
  return <Navigate to={getStartScreenPath(settings.startScreen)} replace />;
}

export default function App() {
  const { checkAuth, isLoading } = useAuth();
  const isTelegramMiniApp = window.location.pathname.startsWith('/tg');

  useEffect(() => {
    if (!isTelegramMiniApp) {
      checkAuth();
    }
  }, [checkAuth, isTelegramMiniApp]);

  if (isLoading && !isTelegramMiniApp) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'background.default' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/tg" element={<TelegramMiniApp />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<HomeRedirect />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="finance" element={<Finance />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="habits" element={<Habits />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="settings" element={<Settings />} />
        <Route path="admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
