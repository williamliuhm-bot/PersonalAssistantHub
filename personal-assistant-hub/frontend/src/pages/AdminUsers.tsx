import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  authApi,
  type SubscriptionStatus,
  type User,
} from '../api/auth';
import { useTranslation } from '../i18n/useTranslation';

const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  'free',
  'trial',
  'active',
  'past_due',
  'cancelled',
  'expired',
];

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

export default function AdminUsers() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | ''>('');
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await authApi.listUsers({
        search: search.trim() || undefined,
        subscription_status: statusFilter || undefined,
        limit: 100,
      });
      setUsers(data.items);
      setTotal(data.total);
    } catch {
      setError(t('admin.loadError'));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, t]);

  useEffect(() => {
    const timer = setTimeout(loadUsers, 300);
    return () => clearTimeout(timer);
  }, [loadUsers]);

  const handleActiveChange = async (user: User, isActive: boolean) => {
    try {
      const { data } = await authApi.updateUser(user.id, { is_active: isActive });
      setUsers((prev) => prev.map((u) => (u.id === data.id ? data : u)));
    } catch {
      setError(t('admin.updateError'));
    }
  };

  const handleStatusChange = async (user: User, subscription_status: SubscriptionStatus) => {
    try {
      const { data } = await authApi.updateUser(user.id, { subscription_status });
      setUsers((prev) => prev.map((u) => (u.id === data.id ? data : u)));
    } catch {
      setError(t('admin.updateError'));
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        {t('admin.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('admin.subtitle')}
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          label={t('admin.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 220 }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>{t('admin.filterStatus')}</InputLabel>
          <Select
            label={t('admin.filterStatus')}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SubscriptionStatus | '')}
          >
            <MenuItem value="">{t('admin.allStatuses')}</MenuItem>
            {SUBSCRIPTION_STATUSES.map((status) => (
              <MenuItem key={status} value={status}>
                {t(`admin.status.${status}`)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
          {t('admin.total')}: {total}
        </Typography>
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('admin.colUser')}</TableCell>
                <TableCell>{t('admin.colRole')}</TableCell>
                <TableCell>{t('admin.colActive')}</TableCell>
                <TableCell>{t('admin.colSubscription')}</TableCell>
                <TableCell>{t('admin.colPlan')}</TableCell>
                <TableCell>{t('admin.colExpires')}</TableCell>
                <TableCell>{t('admin.colRegistered')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {user.username}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {user.email}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={user.role === 'admin' ? t('admin.roleAdmin') : t('admin.roleUser')}
                      color={user.role === 'admin' ? 'secondary' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={user.is_active}
                      onChange={(e) => handleActiveChange(user, e.target.checked)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      size="small"
                      value={user.subscription_status}
                      onChange={(e) =>
                        handleStatusChange(user, e.target.value as SubscriptionStatus)
                      }
                      sx={{ minWidth: 130 }}
                    >
                      {SUBSCRIPTION_STATUSES.map((status) => (
                        <MenuItem key={status} value={status}>
                          {t(`admin.status.${status}`)}
                        </MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell>{user.subscription_plan || '—'}</TableCell>
                  <TableCell>{formatDate(user.subscription_expires_at)}</TableCell>
                  <TableCell>{formatDate(user.created_at)}</TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    {t('admin.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
