import { useState, useEffect, type ReactNode } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  AccountBalance,
  TrendingUp,
  TrendingDown,
  Assignment,
  Whatshot,
  Lightbulb,
  CurrencyRuble,
} from '@mui/icons-material';
import type { SvgIconComponent } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { motion } from 'framer-motion';
import type { AxiosResponse } from 'axios';
import { financeApi, type FinanceReport } from '../api/finance';
import { tasksApi, type Task, type Habit } from '../api/tasks';
import { analyticsApi } from '../api/analytics';
import { currencySymbol, formatMoney } from '../utils/currency';
import { useSettings } from '../store/settingsStore';
import { buildExpenseBreakdownRub } from '../utils/financeStats';

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function StatCardIcon({
  icon: Icon,
  color,
  bgcolor,
}: {
  icon: SvgIconComponent;
  color: string;
  bgcolor: string;
}) {
  return (
    <Box
      sx={{
        flexShrink: 0,
        width: '2.2em',
        height: '2.2em',
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor,
      }}
    >
      <Icon sx={{ color, fontSize: '1.35em' }} />
    </Box>
  );
}

function MoneyAmount({
  amount,
  currency,
  prefix = '',
  color,
}: {
  amount: number;
  currency?: string;
  prefix?: string;
  color?: string;
}) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: '0.25em',
        whiteSpace: 'nowrap',
        color,
        flexShrink: 0,
      }}
    >
      {prefix ? (
        <Box component="span" sx={{ fontWeight: 700, fontSize: '1.65em', lineHeight: 1.15, flexShrink: 0 }}>
          {prefix}
        </Box>
      ) : null}
      <Box component="span" sx={{ fontWeight: 700, fontSize: '1.65em', lineHeight: 1.15 }}>
        {Number(amount).toLocaleString()}
      </Box>
      <Box component="span" sx={{ fontSize: '1.05em', color: color ? 'inherit' : 'text.secondary', flexShrink: 0, opacity: color ? 0.85 : 1 }}>
        {currencySymbol(currency)}
      </Box>
    </Box>
  );
}

const cardContentSx = {
  pl: 'clamp(16px, 2cqw, 28px)',
  pr: 'clamp(14px, 1.8cqw, 24px)',
  pt: 'clamp(16px, 1.8cqw, 24px)',
  pb: 'clamp(16px, 1.8cqw, 24px)',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  '&:last-child': { pb: 'clamp(16px, 1.8cqw, 24px)' },
} as const;

const statCardSx = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  minWidth: 0,
  minHeight: 'clamp(148px, 11cqw, 210px)',
  height: '100%',
} as const;

function DashboardStatCard({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <motion.div variants={itemVariants} style={{ height: '100%' }}>
      <Card onClick={onClick} sx={{ ...statCardSx, cursor: onClick ? 'pointer' : 'default' }}>
        <CardContent sx={cardContentSx}>{children}</CardContent>
      </Card>
    </motion.div>
  );
}

import { buildExpenseBreakdownRub } from '../utils/financeStats';

export default function Dashboard() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [report, setReport] = useState<FinanceReport | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [insightText, setInsightText] = useState<string | null>(null);
  const [pieData, setPieData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      financeApi.getReports().catch(() => null),
      financeApi.getTransactions({ per_page: 500 }).catch(() => null),
      financeApi.getAccounts().catch(() => null),
      tasksApi.getTasks().catch(() => ({ data: [] as Task[] }) as AxiosResponse<Task[]>),
      tasksApi.getHabits().catch(() => ({ data: [] as Habit[] }) as AxiosResponse<Habit[]>),
      analyticsApi.getInsights().catch(() => null),
    ]).then(([r, txResp, accResp, t, h, insights]) => {
      if (r) setReport(r.data);
      const tx = txResp?.data;
      const accounts = accResp?.data;
      if (tx) {
        setPieData(buildExpenseBreakdownRub(
          tx,
          'month',
          (item) =>
            item.account_currency ||
            accounts?.find((a) => a.id === item.account_id)?.currency ||
            'RUB',
          settings.primaryCurrency,
        ));
      }
      setTasks(t.data || []);
      setHabits(h.data || []);
      if (insights?.data?.insight) {
        setInsightText(insights.data.insight);
      }
      setLoading(false);
    });
  }, [settings.primaryCurrency]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const totalBalance = report?.total_balance ?? 0;
  const balancesByCurrency = report?.balances_by_currency ?? [];
  const monthlyByCurrency = report?.monthly_by_currency ?? [];
  const primaryMonthly = monthlyByCurrency[0];
  const monthlyIncome = primaryMonthly?.income ?? report?.monthly_income ?? 0;
  const monthlyExpenses = primaryMonthly?.expenses ?? report?.monthly_expenses ?? 0;
  const incomeCurrency = primaryMonthly?.currency;
  const expenseCurrency = primaryMonthly?.currency;
  const tasksCompleted = tasks.filter((t) => t.status === 'done').length;
  const tasksActive = tasks.filter((t) => t.status !== 'done').length;
  const maxStreak = habits.length > 0 ? Math.max(...habits.map((h) => h.streak)) : 0;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      <Box
        sx={{
          containerType: 'inline-size',
          width: '100%',
          fontSize: 'clamp(0.72rem, 1.15cqw, 0.875rem)',
        }}
      >
        <Typography
          variant="h4"
          sx={{
            mb: 3,
            fontWeight: 700,
            fontSize: 'clamp(1.35rem, 3cqw, 2rem)',
            textAlign: 'center',
          }}
        >
          Dashboard
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'clamp(16px, 2cqw, 28px)', width: '100%' }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                sm: 'repeat(3, minmax(0, 1fr))',
                lg: 'repeat(5, minmax(0, 1fr))',
              },
              gap: 'clamp(10px, 1.5cqw, 24px)',
              width: '100%',
            }}
          >
          {settings.dashboardShowBalance ? (
          <DashboardStatCard onClick={() => navigate('/finance')}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5em', mb: '0.85em', flexWrap: 'nowrap' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9em', lineHeight: 1.3 }}>
                Общий баланс
              </Typography>
              <StatCardIcon icon={AccountBalance} color="primary.main" bgcolor="rgba(37, 99, 235, 0.12)" />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '0.45em', alignItems: 'baseline', rowGap: '0.25em' }}>
              {balancesByCurrency.length > 0 ? (
                balancesByCurrency.map((b) => (
                  <MoneyAmount key={b.currency} amount={b.amount} currency={b.currency} />
                ))
              ) : (
                <MoneyAmount amount={totalBalance} currency={settings.primaryCurrency} />
              )}
            </Box>
            <Chip
              label={totalBalance >= 0 ? 'Плюс' : 'Минус'}
              color={totalBalance >= 0 ? 'success' : 'error'}
              size="small"
              sx={{ mt: 'auto', alignSelf: 'flex-start', fontSize: '0.75em', fontWeight: 500, maxWidth: '100%' }}
            />
          </DashboardStatCard>
          ) : null}

          {settings.dashboardShowBudgets ? (
          <>
          <DashboardStatCard>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5em', mb: '0.85em', flexWrap: 'nowrap' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9em' }}>Доходы</Typography>
              <StatCardIcon icon={TrendingUp} color="success.main" bgcolor="rgba(16, 185, 129, 0.12)" />
            </Box>
            <MoneyAmount amount={monthlyIncome} currency={incomeCurrency || settings.primaryCurrency} prefix="+" color="success.main" />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 'auto', pt: '0.75em', display: 'block', fontSize: '0.85em', lineHeight: 1.3 }}>
              За месяц
            </Typography>
          </DashboardStatCard>

          <DashboardStatCard>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5em', mb: '0.85em', flexWrap: 'nowrap' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9em' }}>Расходы</Typography>
              <StatCardIcon icon={TrendingDown} color="error.main" bgcolor="rgba(239, 68, 68, 0.12)" />
            </Box>
            <MoneyAmount amount={monthlyExpenses} currency={expenseCurrency || settings.primaryCurrency} prefix="-" color="error.main" />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 'auto', pt: '0.75em', display: 'block', fontSize: '0.85em', lineHeight: 1.3 }}>
              За месяц
            </Typography>
          </DashboardStatCard>
          </>
          ) : null}

          <DashboardStatCard>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5em', mb: '0.85em', flexWrap: 'nowrap' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9em' }}>Задачи</Typography>
              <StatCardIcon icon={Assignment} color="primary.main" bgcolor="rgba(37, 99, 235, 0.12)" />
            </Box>
            <Box sx={{ display: 'flex', gap: '1.25em', flexWrap: 'nowrap' }}>
              <Box>
                <Typography sx={{ fontWeight: 700, color: 'success.main', fontSize: '1.65em', lineHeight: 1.15 }}>
                  {tasksCompleted}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.85em', whiteSpace: 'nowrap' }}>
                  Готово
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '1.65em', lineHeight: 1.15 }}>{tasksActive}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.85em', whiteSpace: 'nowrap' }}>
                  Активно
                </Typography>
              </Box>
            </Box>
          </DashboardStatCard>

          <DashboardStatCard>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5em', mb: '0.85em', flexWrap: 'nowrap' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9em' }}>Привычки</Typography>
              <StatCardIcon icon={Whatshot} color="warning.main" bgcolor="rgba(245, 158, 11, 0.12)" />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '0.4em', flexWrap: 'wrap' }}>
              <Typography sx={{ fontWeight: 700, color: 'warning.main', fontSize: '1.65em', lineHeight: 1.15, flexShrink: 0 }}>
                {maxStreak}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85em', lineHeight: 1.3 }}>
                дней серия
              </Typography>
            </Box>
          </DashboardStatCard>
        </Box>

        {settings.dashboardShowTransactions ? (
        <motion.div variants={itemVariants} style={{ width: '100%', minWidth: 0 }}>
          <Card sx={{ ...statCardSx, minHeight: 'auto' }}>
            <CardContent sx={{ ...cardContentSx, height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 2, flexWrap: 'nowrap' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, fontSize: '1.05em' }}>
                  Расходы по категориям
                </Typography>
                <StatCardIcon icon={CurrencyRuble} color="primary.main" bgcolor="rgba(37, 99, 235, 0.12)" />
              </Box>
              {pieData.length > 0 ? (
                <Box sx={{ width: '100%', height: 'clamp(220px, 22cqw, 340px)' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius="55%"
                      outerRadius="85%"
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                    >
                      {pieData.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: '#1E293B',
                        border: '1px solid rgba(148, 163, 184, 0.12)',
                        borderRadius: 8,
                      }}
                      formatter={(value: number) => formatMoney(value, settings.primaryCurrency)}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => <span style={{ color: '#94A3B8', fontSize: 12 }}>{value}</span>}
                    />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 6 }}>
                  Нет данных
                </Typography>
              )}
            </CardContent>
          </Card>
        </motion.div>
        ) : null}
      </Box>

        {insightText && (
          <Box sx={{ mt: 2.5 }}>
            <motion.div variants={itemVariants}>
              <Card
                sx={{
                  background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.1), rgba(124, 58, 237, 0.1))',
                  border: '1px solid rgba(37, 99, 235, 0.2)',
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <StatCardIcon icon={Lightbulb} color="#F59E0B" bgcolor="rgba(245, 158, 11, 0.12)" />
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      AI Инсайт
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.primary' }}>
                    {insightText}
                  </Typography>
                </CardContent>
              </Card>
            </motion.div>
          </Box>
        )}
      </Box>
    </motion.div>
  );
}
