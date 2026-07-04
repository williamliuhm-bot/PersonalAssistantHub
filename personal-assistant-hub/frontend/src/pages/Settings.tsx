import { Box, Card, CardContent, Typography, Divider, Button } from '@mui/material';
import { Person, Email, Logout } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/authStore';

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 700 }}>
        Настройки
      </Typography>

      <Card sx={{ maxWidth: 560 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            Профиль
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Person color="primary" />
            <Box>
              <Typography variant="body2" color="text.secondary">Имя</Typography>
              <Typography variant="body1">{user?.username || '—'}</Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Email color="primary" />
            <Box>
              <Typography variant="body2" color="text.secondary">Email</Typography>
              <Typography variant="body1">{user?.email || '—'}</Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            API
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Backend: {import.meta.env.VITE_API_URL || 'http://localhost:8000'}
          </Typography>

          <Button
            variant="outlined"
            color="error"
            startIcon={<Logout />}
            onClick={handleLogout}
          >
            Выйти из аккаунта
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
