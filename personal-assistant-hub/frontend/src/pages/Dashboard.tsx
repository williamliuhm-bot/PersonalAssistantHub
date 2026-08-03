import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  CircularProgress,
  IconButton,
  MenuItem,
  Select,
  Typography,
  useTheme,
} from '@mui/material';
import {
  WorkOutline,
  ShoppingBagOutlined,
  LocalGroceryStoreOutlined,
  FitnessCenterOutlined,
  DirectionsCarOutlined,
  LocalLaundryServiceOutlined,
  MoreVert,
  TrendingUp,
  ContactlessOutlined,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import type { AxiosResponse } from 'axios';
import { financeApi, type Account, type Budget, type Transaction } from '../api/finance';
import { tasksApi, type Task } from '../api/tasks';
import { formatMoney, convertCurrency } from '../utils/currency';
import { useSettings } from '../store/settingsStore';
import { useAuth } from '../store/authStore';
import SoftCard from '../components/SoftCard';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  shopping: <ShoppingBagOutlined fontSize="small" />,
  grocery: <LocalGroceryStoreOutlined fontSize="small" />,
  gym: <FitnessCenterOutlined fontSize="small" />,
  laundry: <LocalLaundryServiceOutlined fontSize="small" />,
  car: <DirectionsCarOutlined fontSize="small" />,
};

function iconForCategory(name?: string) {
  const key = (name || '').toLowerCase();
  for (const [k, icon] of Object.entries(CATEGORY_ICONS)) {
    if (key.includes(k) || key.includes(k.slice(0, 3))) return icon;
  }
  return <ShoppingBagOutlined fontSize="small" />;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { settings } = useSettings();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    Promise.all([
      financeApi.getAccounts().catch(() => ({ data: [] as Account[] })),
      financeApi.getTransactions({ per_page: 100 }).catch(() => ({ data: [] as Transaction[] })),
      financeApi.getBudgets().catch(() => ({ data: [] as Budget[] })),
      tasksApi.getTasks().catch(() => ({ data: [] as Task[] }) as AxiosResponse<Task[]>),
    ]).then(([a, t, b, tasksResp]) => {
      setAccounts(Array.isArray(a.data) ? a.data : []);
      setTransactions(Array.isArray(t.data) ? t.data : []);
      setBudgets(Array.isArray(b.data) ? b.data : []);
      setTasks(tasksResp.data || []);
      setLoading(false);
    });
  }, []);

  const displayCurrency = settings.primaryCurrency;
  const totalBalance = useMemo(
    () =>
      accounts.reduce(
        (sum, a) => sum + convertCurrency(Number(a.balance || 0), a.currency, displayCurrency),
        0,
      ),
    [accounts, displayCurrency],
  );
  const balanceLabel =
    accounts.length === 0 ? 'Баланс' : accounts.length === 1 ? accounts[0].name : 'Общий баланс';
  const cardHolderName = user?.username || balanceLabel;
  const maskedCardNumber = useMemo(() => {
    const seed = user?.id ?? cardHolderName.length;
    const last4 = String(seed).padStart(4, '0').slice(-4);
    return `•••• •••• •••• ${last4}`;
  }, [user?.id, cardHolderName]);
  const cardExpiry = dayjs().add(3, 'year').format('MM/YY');

  const recentTx = useMemo(() => {
    const list = [...transactions];
    if (sortBy === 'amount') {
      list.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    } else {
      list.sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());
    }
    return list.slice(0, 6);
  }, [transactions, sortBy]);

  const upcomingTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== 'done' && t.deadline)
        .sort((a, b) => dayjs(a.deadline).valueOf() - dayjs(b.deadline).valueOf())
        .slice(0, 2),
    [tasks],
  );

  const chartData = useMemo(() => {
    const months: { name: string; value: number }[] = [];
    const now = dayjs();
    const count = period === 'week' ? 7 : period === 'year' ? 12 : 6;
    for (let i = count - 1; i >= 0; i--) {
      const d = period === 'week' ? now.subtract(i, 'day') : now.subtract(i, 'month');
      const label = period === 'week' ? d.format('dd') : d.format('MMM');
      const value = transactions
        .filter((tx) => {
          const td = dayjs(tx.date);
          if (period === 'week') return td.isSame(d, 'day') && tx.transaction_type === 'expense';
          return td.isSame(d, 'month') && tx.transaction_type === 'expense';
        })
        .reduce((s, tx) => s + Math.abs(Number(tx.amount)), 0);
      months.push({ name: label, value });
    }
    return months;
  }, [transactions, period]);

  const savedThisMonth = useMemo(() => {
    const now = dayjs();
    const income = transactions
      .filter((t) => t.transaction_type === 'income' && dayjs(t.date).isSame(now, 'month'))
      .reduce((s, t) => s + Number(t.amount), 0);
    const expense = transactions
      .filter((t) => t.transaction_type === 'expense' && dayjs(t.date).isSame(now, 'month'))
      .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    return income - expense;
  }, [transactions]);

  const budgetProgress = useMemo(() => {
    if (!budgets.length) return 0;
    const totalLimit = budgets.reduce((s, b) => s + Number(b.limit_amount || 0), 0);
    const totalSpent = budgets.reduce((s, b) => s + Number(b.spent_amount || 0), 0);
    if (!totalLimit) return 0;
    return Math.min(100, Math.round((totalSpent / totalLimit) * 100));
  }, [budgets]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: '1.6fr 1fr' },
        gap: 2.5,
        alignItems: 'start',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1.2fr 1fr' },
            gap: 2,
          }}
        >
          {settings.dashboardShowBalance !== false && (
            <Box sx={{ width: '100%', containerType: 'inline-size' }}>
            <SoftCard
              interactive
              onClick={() => navigate('/finance')}
              padding={0}
              sx={{
                position: 'relative',
                overflow: 'hidden',
                width: '100%',
                height: 'calc(100cqw / 1.586 - 6px)',
                minHeight: { xs: 184, sm: 204 },
                borderRadius: '20px',
                color: '#FCFCFC',
                bgcolor: '#1a1a1a',
                background: 'linear-gradient(155deg, #1a1a1a 0%, #0f0f0f 45%, #080808 100%)',
                boxShadow: '0 10px 28px rgba(0,0,0,0.35)',
                border: 'none',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  inset: 0,
                  opacity: 0.15,
                  backgroundImage:
                    'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
                  backgroundSize: '180px 180px',
                  pointerEvents: 'none',
                },
              }}
            >
              <Box
                sx={{
                  position: 'relative',
                  zIndex: 1,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: { xs: 1.25, sm: 1.5 },
                  p: { xs: '1.2rem', sm: '1.5rem' },
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <Box
                      sx={{
                        width: 44,
                        height: 32,
                        borderRadius: '6px',
                        background: 'linear-gradient(145deg, #e8c96a 0%, #c9a227 50%, #9a7b1a 100%)',
                        position: 'relative',
                        overflow: 'hidden',
                        flexShrink: 0,
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          left: 8,
                          right: 8,
                          top: 8,
                          bottom: 8,
                          borderRadius: '3px',
                          border: '1px solid rgba(0,0,0,0.15)',
                          background:
                            'repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 2px, transparent 2px, transparent 5px)',
                        },
                      }}
                    />
                    <ContactlessOutlined sx={{ fontSize: 28, color: '#FCFCFC', opacity: 0.95 }} />
                  </Box>
                  <Box sx={{ textAlign: 'right', lineHeight: 1 }}>
                    <Typography
                      sx={{
                        fontWeight: 700,
                        fontSize: { xs: 'clamp(0.7rem, 2.8vw, 0.9rem)', sm: '0.9rem' },
                        letterSpacing: '0.18em',
                        color: '#FCFCFC',
                      }}
                    >
                      VISA
                    </Typography>
                    <Typography
                      sx={{
                        fontWeight: 500,
                        fontSize: { xs: '0.55rem', sm: '0.62rem' },
                        letterSpacing: '0.22em',
                        color: '#FCFCFC',
                        mt: 0.25,
                      }}
                    >
                      PLATINUM
                    </Typography>
                  </Box>
                </Box>

                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    gap: 1,
                  }}
                >
                  <Box
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.1)',
                      borderRadius: '14px',
                      px: { xs: 2, sm: 2.5 },
                      py: { xs: 1.1, sm: 1.35 },
                      textAlign: 'left',
                    }}
                  >
                    <Typography
                      sx={{
                        fontWeight: 600,
                        fontSize: { xs: 'clamp(1.1rem, 3.8vw, 1.45rem)', sm: '1.5rem' },
                        letterSpacing: '0.02em',
                        lineHeight: 1.2,
                        fontVariantNumeric: 'tabular-nums',
                        color: '#FCFCFC',
                      }}
                    >
                      {formatMoney(totalBalance, displayCurrency)}
                    </Typography>
                  </Box>
                  <Typography
                    sx={{
                      fontWeight: 500,
                      fontSize: { xs: 'clamp(0.85rem, 2.6vw, 1rem)', sm: '1.05rem' },
                      letterSpacing: '0.22em',
                      color: '#FCFCFC',
                      opacity: 0.85,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {maskedCardNumber}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontWeight: 500,
                        fontSize: 9,
                        letterSpacing: '0.08em',
                        color: '#FCFCFC',
                        opacity: 0.75,
                      }}
                    >
                      {cardExpiry}
                    </Typography>
                    <Typography
                      sx={{
                        fontWeight: 500,
                        fontSize: 11,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: '#FCFCFC',
                        opacity: 0.92,
                        mt: 0.5,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cardHolderName}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          bgcolor: '#EB001B',
                        }}
                      />
                      <Box
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          bgcolor: '#F79E1B',
                          ml: -1.25,
                        }}
                      />
                    </Box>
                    <Typography
                      sx={{
                        fontSize: 11,
                        fontWeight: 500,
                        letterSpacing: '0.02em',
                        color: '#FCFCFC',
                        opacity: 0.92,
                        mt: 0.5,
                      }}
                    >
                      Mastercard
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </SoftCard>
            </Box>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, px: 0.5 }}>
              Ближайшие
            </Typography>
            {(upcomingTasks.length
              ? upcomingTasks
              : budgets.slice(0, 2).map((b) => ({
                  id: b.id,
                  title: b.category_name || 'Бюджет',
                  description: `Лимит ${formatMoney(b.limit_amount, displayCurrency)}`,
                  deadline: b.period_end,
                }))
            ).map((item: { id: number; title: string; description?: string; deadline?: string }, idx) => (
              <SoftCard
                key={item.id}
                interactive
                onClick={() => navigate(upcomingTasks.length ? '/tasks' : '/finance')}
                padding={2}
                sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    bgcolor: idx === 0 ? 'rgba(16,185,129,0.12)' : 'rgba(59,130,246,0.12)',
                    color: idx === 0 ? 'success.main' : 'info.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <WorkOutline fontSize="small" />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14 }} noWrap>
                    {item.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {item.deadline
                      ? dayjs(item.deadline).format('DD MMM YYYY')
                      : item.description || 'Без даты'}
                  </Typography>
                </Box>
                <TrendingUp sx={{ color: 'text.secondary', fontSize: 18 }} />
              </SoftCard>
            ))}
            {!upcomingTasks.length && !budgets.length && (
              <SoftCard padding={2}>
                <Typography variant="body2" color="text.secondary">
                  Нет ближайших задач или бюджетов
                </Typography>
              </SoftCard>
            )}
          </Box>
        </Box>

        {settings.dashboardShowTransactions !== false && (
          <SoftCard>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Недавние транзакции
              </Typography>
              <Select
                size="small"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'amount')}
                sx={{ borderRadius: 999, fontSize: 13, minWidth: 120 }}
              >
                <MenuItem value="date">По дате</MenuItem>
                <MenuItem value="amount">По сумме</MenuItem>
              </Select>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {recentTx.map((tx) => (
                <Box
                  key={tx.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    py: 1.25,
                    px: 1,
                    borderRadius: 2,
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: 2,
                      bgcolor: 'action.hover',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'text.secondary',
                    }}
                  >
                    {iconForCategory(tx.category_name)}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }} noWrap>
                      {tx.category_name || tx.description || 'Транзакция'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {dayjs(tx.date).format('DD MMM YYYY HH:mm')}
                    </Typography>
                  </Box>
                  <Typography
                    sx={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: tx.transaction_type === 'income' ? 'success.main' : 'text.primary',
                    }}
                  >
                    {tx.transaction_type === 'income' ? '+' : '-'}
                    {formatMoney(Math.abs(tx.amount), tx.account_currency || displayCurrency)}
                  </Typography>
                  <IconButton size="small">
                    <MoreVert fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              {!recentTx.length && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                  Пока нет транзакций
                </Typography>
              )}
            </Box>
          </SoftCard>
        )}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <SoftCard sx={{ minHeight: 360 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            Сэкономлено за месяц
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 2, letterSpacing: '-0.02em' }}>
            {formatMoney(savedThisMonth, displayCurrency)}
          </Typography>

          <Box
            sx={{
              display: 'flex',
              gap: 0.5,
              p: 0.5,
              borderRadius: 999,
              bgcolor: 'action.hover',
              mb: 2.5,
              width: 'fit-content',
            }}
          >
            {(['week', 'month', 'year'] as const).map((p) => (
              <Box
                key={p}
                onClick={() => setPeriod(p)}
                sx={{
                  px: 1.75,
                  py: 0.6,
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  bgcolor: period === p ? 'background.paper' : 'transparent',
                  boxShadow: period === p ? 1 : 0,
                  color: period === p ? 'text.primary' : 'text.secondary',
                }}
              >
                {p === 'week' ? 'Неделя' : p === 'month' ? 'Месяц' : 'Год'}
              </Box>
            ))}
          </Box>

          <Box sx={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="dashFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isDark ? '#F8FAFC' : '#111827'} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={isDark ? '#F8FAFC' : '#111827'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: 'none',
                    boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(15,23,42,0.1)',
                    background: theme.palette.background.paper,
                  }}
                  formatter={(v: number) => formatMoney(v, displayCurrency)}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={isDark ? '#F8FAFC' : '#111827'}
                  strokeWidth={2.5}
                  fill="url(#dashFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </SoftCard>

        <SoftCard
          sx={{
            background: isDark
              ? 'linear-gradient(160deg, #222631, #15171e)'
              : 'linear-gradient(160deg, #1f2430, #11141b)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 2.5,
          }}
        >
          <Box sx={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
            <CircularProgress
              variant="determinate"
              value={100}
              size={96}
              thickness={3}
              sx={{ color: 'rgba(255,255,255,0.12)', position: 'absolute' }}
            />
            <CircularProgress
              variant="determinate"
              value={budgetProgress}
              size={96}
              thickness={3}
              sx={{ color: '#fff', position: 'absolute' }}
            />
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 18,
              }}
            >
              {budgetProgress}%
            </Box>
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>План на месяц</Typography>
            <Typography sx={{ fontSize: 13, opacity: 0.65 }}>
              {budgets.length
                ? `Выполнено по бюджетам: ${budgetProgress}%`
                : 'Добавьте бюджеты во вкладке Финансы'}
            </Typography>
          </Box>
        </SoftCard>
      </Box>
    </Box>
  );
}
