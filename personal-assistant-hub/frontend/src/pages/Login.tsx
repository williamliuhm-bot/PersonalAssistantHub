import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff, Email, Lock, Person } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '../store/authStore';
import { useSettings } from '../store/settingsStore';
import { getStartScreenPath } from '../types/settings';
import SoftCard from '../components/SoftCard';

export default function Login() {
  const [tabIndex, setTabIndex] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register, isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  if (isAuthenticated) {
    navigate(getStartScreenPath(settings.startScreen), { replace: true });
    return null;
  }

  const handleLogin = async () => {
    if (!username || !password) {
      setError('Заполните все поля');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login({ email: username, password });
      navigate(getStartScreenPath(settings.startScreen), { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка входа');
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!username || !email || !password || !password2) {
      setError('Заполните все поля');
      return;
    }
    if (password !== password2) {
      setError('Пароли не совпадают');
      return;
    }
    if (password.length < 8) {
      setError('Пароль должен быть не менее 8 символов');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await register({ username, email, password });
      navigate(getStartScreenPath(settings.startScreen), { replace: true });
    } catch (err: any) {
      const detail = err.response?.data;
      if (typeof detail === 'object') {
        setError(Object.values(detail).flat().join('. '));
      } else {
        setError(detail || 'Ошибка регистрации');
      }
    }
    setLoading(false);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        position: 'relative',
        overflow: 'hidden',
        p: 2,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: -160,
          right: -120,
          width: 420,
          height: 420,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: -180,
          left: -140,
          width: 380,
          height: 380,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ width: '100%', maxWidth: 440, position: 'relative' }}
      >
        <SoftCard padding={4}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 3,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 800,
                mx: 'auto',
                mb: 2,
              }}
            >
              H
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
              Assistant Hub
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Финансы, задачи и привычки в одном месте
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              gap: 0.5,
              p: 0.5,
              borderRadius: 999,
              bgcolor: 'action.hover',
              mb: 3,
            }}
          >
            {['Вход', 'Регистрация'].map((label, idx) => (
              <Box
                key={label}
                onClick={() => {
                  setTabIndex(idx);
                  setError('');
                }}
                sx={{
                  flex: 1,
                  textAlign: 'center',
                  py: 1,
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                  bgcolor: tabIndex === idx ? 'background.paper' : 'transparent',
                  boxShadow: tabIndex === idx ? 1 : 0,
                }}
              >
                {label}
              </Box>
            ))}
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {tabIndex === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Email или имя пользователя"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Пароль"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} size="small" edge="end">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Button variant="contained" size="large" onClick={handleLogin} disabled={loading} sx={{ mt: 1, py: 1.4 }}>
                {loading ? 'Вход...' : 'Войти'}
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Имя пользователя"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Person fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Пароль"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} size="small" edge="end">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Подтвердите пароль"
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                fullWidth
                onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <Button variant="contained" size="large" onClick={handleRegister} disabled={loading} sx={{ mt: 1, py: 1.4 }}>
                {loading ? 'Регистрация...' : 'Зарегистрироваться'}
              </Button>
            </Box>
          )}
        </SoftCard>
      </motion.div>
    </Box>
  );
}
