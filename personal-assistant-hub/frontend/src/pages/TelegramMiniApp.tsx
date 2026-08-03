import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import SoftCard from '../components/SoftCard';
import { financeApi, type Account, type Category, type Transaction } from '../api/finance';
import { telegramWebAppApi } from '../api/telegramWebApp';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        ready: () => void;
        expand: () => void;
        close: () => void;
        themeParams?: Record<string, string>;
        colorScheme?: 'light' | 'dark';
        MainButton?: {
          setText: (t: string) => void;
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
        };
      };
    };
  }
}

type TxMode = 'expense' | 'income';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function TelegramMiniApp() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [mode, setMode] = useState<TxMode>('expense');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState<number | ''>('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const loadFinance = useCallback(async () => {
    const [accRes, catRes, txRes] = await Promise.all([
      financeApi.getAccounts(),
      financeApi.getCategories(),
      financeApi.getTransactions({ page: 1, per_page: 20 }),
    ]);
    const accs = accRes.data;
    setAccounts(accs);
    setCategories(catRes.data);
    setTransactions(txRes.data);
    if (accs.length && accountId === '') {
      setAccountId(accs[0].id);
    }
  }, [accountId]);

  useEffect(() => {
    const wa = window.Telegram?.WebApp;
    wa?.ready();
    wa?.expand();

    const run = async () => {
      try {
        const initData = wa?.initData || '';
        if (!initData) {
          setError(
            'Откройте мини-приложение из Telegram-бота (кнопка меню или /app). Прямой браузер не подходит.',
          );
          setLoading(false);
          return;
        }
        const auth = await telegramWebAppApi.auth(initData);
        localStorage.setItem('access_token', auth.access_token);
        await loadFinance();
      } catch (e: unknown) {
        const detail =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          'Не удалось войти через Telegram';
        setError(typeof detail === 'string' ? detail : 'Ошибка авторизации');
      } finally {
        setLoading(false);
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredCategories = categories.filter((c) => c.type === mode);

  const handleSubmit = async () => {
    const value = Number(String(amount).replace(',', '.'));
    if (!value || value <= 0 || accountId === '') {
      setFlash('Укажите сумму и счёт');
      return;
    }
    setSaving(true);
    setFlash(null);
    try {
      await financeApi.createTransaction({
        account_id: Number(accountId),
        category_id: categoryId === '' ? null : Number(categoryId),
        amount: value,
        description: description || undefined,
        transaction_type: mode,
        date: todayISO(),
        is_recurring: false,
      });
      setAmount('');
      setDescription('');
      setCategoryId('');
      setFlash(mode === 'expense' ? 'Расход записан' : 'Доход записан');
      await loadFinance();
    } catch {
      setFlash('Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2, minHeight: '100vh', bgcolor: 'background.default' }}>
        <Alert severity="warning">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, pb: 4, minHeight: '100vh', bgcolor: 'background.default' }}>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 0.5 }}>
        Финансы
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Счета и быстрые операции
      </Typography>

      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
        Счета
      </Typography>
      <Box sx={{ display: 'grid', gap: 1.25, mb: 2.5 }}>
        {accounts.map((a) => (
          <SoftCard key={a.id} padding={2}>
            <Typography fontWeight={700}>{a.name}</Typography>
            <Typography variant="h6" sx={{ mt: 0.5 }}>
              {Number(a.balance).toLocaleString('ru-RU')} {a.currency}
            </Typography>
          </SoftCard>
        ))}
        {!accounts.length ? (
          <Alert severity="info">Нет счетов — создайте их в веб-приложении.</Alert>
        ) : null}
      </Box>

      <SoftCard padding={2} sx={{ mb: 2.5 }}>
        <Tabs
          value={mode}
          onChange={(_, v) => {
            setMode(v);
            setCategoryId('');
          }}
          variant="fullWidth"
          sx={{ mb: 2 }}
        >
          <Tab value="expense" label="Расход" />
          <Tab value="income" label="Доход" />
        </Tabs>

        <TextField
          fullWidth
          size="small"
          label="Сумма"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          sx={{ mb: 1.5 }}
          inputMode="decimal"
        />

        <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
          <InputLabel>Счёт</InputLabel>
          <Select
            label="Счёт"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            {accounts.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
          <InputLabel>Категория</InputLabel>
          <Select
            label="Категория"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <MenuItem value="">Без категории</MenuItem>
            {filteredCategories.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          fullWidth
          size="small"
          label="Описание"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          sx={{ mb: 1.5 }}
        />

        {flash ? (
          <Alert severity={flash.includes('Не') ? 'error' : 'success'} sx={{ mb: 1.5 }}>
            {flash}
          </Alert>
        ) : null}

        <Button
          fullWidth
          variant="contained"
          disabled={saving}
          onClick={() => void handleSubmit()}
        >
          {saving ? 'Сохранение…' : mode === 'expense' ? 'Добавить расход' : 'Добавить доход'}
        </Button>
      </SoftCard>

      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
        Последние операции
      </Typography>
      <Box sx={{ display: 'grid', gap: 1 }}>
        {transactions.map((t) => (
          <SoftCard key={t.id} padding={1.75}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
              <Box>
                <Typography fontWeight={600}>
                  {t.category_name || t.description || (t.transaction_type === 'expense' ? 'Расход' : 'Доход')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t.account_name} · {t.date}
                </Typography>
              </Box>
              <Typography
                fontWeight={700}
                color={t.transaction_type === 'expense' ? 'error.main' : 'success.main'}
              >
                {t.transaction_type === 'expense' ? '−' : '+'}
                {Number(t.amount).toLocaleString('ru-RU')} {t.account_currency || ''}
              </Typography>
            </Box>
          </SoftCard>
        ))}
        {!transactions.length ? (
          <Typography variant="body2" color="text.secondary">
            Пока нет операций
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}
