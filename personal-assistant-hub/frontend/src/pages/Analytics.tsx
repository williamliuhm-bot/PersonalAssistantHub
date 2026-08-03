import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Grid,
  CircularProgress,
  Chip,
  TextField,
  Button,
  Stack,
} from '@mui/material';
import { Lightbulb } from '@mui/icons-material';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line,
} from 'recharts';
import { motion } from 'framer-motion';
import {
  financeApi,
  type Account,
  type Transaction,
  type BalanceHistorySeries,
} from '../api/finance';
import {
  analyticsApi,
  type ProductivityReport,
  type CorrelationData,
} from '../api/analytics';
import { formatMoney } from '../utils/currency';
import { useSettings } from '../store/settingsStore';
import PageHeader from '../components/PageHeader';
import {
  buildExpenseBreakdownForRange,
  buildDailyFlowRub,
  getDefaultReportRange,
  formatDateRangeRu,
  formatSingleDateRu,
  daysFromDateToToday,
  toLocalDateString,
} from '../utils/financeStats';

const COLORS = ['#111827', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#EC4899', '#06B6D4', '#F97316'];

const CURRENCY_LINE_COLORS: Record<string, string> = {
  RUB: '#111827',
  USD: '#10B981',
  EUR: '#F59E0B',
  GBP: '#6366F1',
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  return value === index ? <motion.div variants={itemVariants} initial="hidden" animate="visible">{children}</motion.div> : null;
}

export default function Analytics() {
  const { settings } = useSettings();
  const displayCurrency = settings.primaryCurrency;
  const [tabValue, setTabValue] = useState(0);
  const defaultRange = getDefaultReportRange();
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);
  const [appliedFrom, setAppliedFrom] = useState(defaultRange.from);
  const [appliedTo, setAppliedTo] = useState(defaultRange.to);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [pieData, setPieData] = useState<{ name: string; value: number }[]>([]);
  const [barData, setBarData] = useState<{ date: string; label: string; Доходы: number; Расходы: number }[]>([]);
  const [balanceHistory, setBalanceHistory] = useState<Array<{ date: string; label: string } & Record<string, number | string>>>([]);
  const [balanceCurrencies, setBalanceCurrencies] = useState<string[]>([]);
  const [productivityReports, setProductivityReports] = useState<ProductivityReport[]>([]);
  const [correlation, setCorrelation] = useState<CorrelationData | null>(null);
  const [insightText, setInsightText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [rangeError, setRangeError] = useState('');

  const getCurrency = useCallback(
    (tx: Transaction) =>
      tx.account_currency || accounts.find((a) => a.id === tx.account_id)?.currency || 'RUB',
    [accounts],
  );

  const loadFinanceCharts = useCallback(async (from: string, to: string) => {
    setFinanceLoading(true);
    try {
      const [txResp, balanceResp] = await Promise.all([
        financeApi.getTransactions({ per_page: 500, date_from: from, date_to: to }),
        financeApi.getBalanceHistory(daysFromDateToToday(from)),
      ]);

      const tx = txResp.data;
      setPieData(buildExpenseBreakdownForRange(tx, from, to, getCurrency, displayCurrency));
      setBarData(buildDailyFlowRub(tx, from, to, getCurrency, displayCurrency));

      const series = balanceResp.data as BalanceHistorySeries[];
      if (series.length > 0) {
        setBalanceCurrencies(series.map((s) => s.currency));
        const byDate: Record<string, { date: string; label: string } & Record<string, number | string>> = {};
        series.forEach((s) => {
          s.points
            .filter((p) => p.date >= from && p.date <= to)
            .forEach((point) => {
              if (!byDate[point.date]) {
                byDate[point.date] = {
                  date: point.date,
                  label: point.date.slice(5).replace('-', '.'),
                };
              }
              byDate[point.date][s.currency] = Number(point.balance);
            });
        });
        setBalanceHistory(
          Object.values(byDate).sort((a, b) => String(a.date).localeCompare(String(b.date))),
        );
      } else {
        setBalanceCurrencies([]);
        setBalanceHistory([]);
      }
    } finally {
      setFinanceLoading(false);
    }
  }, [getCurrency, displayCurrency]);

  useEffect(() => {
    Promise.allSettled([
      financeApi.getAccounts(),
      analyticsApi.getProductivityReports(),
      analyticsApi.getCorrelation(),
      analyticsApi.getInsights(),
    ]).then(async (results) => {
      const get = <T,>(idx: number): T | null =>
        results[idx].status === 'fulfilled' ? (results[idx] as PromiseFulfilledResult<{ data: T }>).value.data : null;

      const acc = get<Account[]>(0);
      const productivity = get<ProductivityReport[]>(1);
      const corr = get<CorrelationData>(2);
      const insights = get<{ insight: string }>(3);

      if (acc) setAccounts(acc);
      if (productivity) setProductivityReports(productivity);
      if (corr) setCorrelation(corr);
      if (insights?.insight) setInsightText(insights.insight);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!loading) {
      loadFinanceCharts(appliedFrom, appliedTo);
    }
  }, [loading, appliedFrom, appliedTo, loadFinanceCharts, displayCurrency]);

  const applyDateRange = () => {
    if (dateFrom > dateTo) {
      setRangeError('Дата начала не может быть позже даты окончания');
      return;
    }
    setRangeError('');
    setAppliedFrom(dateFrom);
    setAppliedTo(dateTo);
  };

  const setPresetRange = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
    setAppliedFrom(from);
    setAppliedTo(to);
    setRangeError('');
  };

  const setCurrentMonth = () => {
    const now = new Date();
    const from = toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
    const to = toLocalDateString(now);
    setPresetRange(from, to);
  };

  const setPrevMonth = () => {
    const now = new Date();
    const from = toLocalDateString(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const to = toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 0));
    setPresetRange(from, to);
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  const totalTasksCompleted = productivityReports.reduce((sum, r) => sum + r.tasks_completed, 0);
  const avgTasksPerDay = productivityReports.length
    ? Math.round(totalTasksCompleted / productivityReports.length)
    : 0;
  const latestCorrelation = correlation?.correlation_score ?? 0;

  const productivityChartData = productivityReports
    .slice()
    .reverse()
    .map((r) => ({
      date: r.report_date.slice(5),
      tasks: r.tasks_completed,
      expenses: r.total_expenses,
    }));

  const scatterData = correlation
    ? correlation.dates.map((date, idx) => ({
        productivity_score: correlation.tasks_completed[idx] ?? 0,
        expenses: correlation.expenses[idx] ?? 0,
        date,
      }))
    : [];

  const barTickInterval = barData.length > 45 ? Math.floor(barData.length / 20) : barData.length > 20 ? 2 : 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <PageHeader title="Отчёты" subtitle="Аналитика финансов и продуктивности" />

      <Tabs
        value={tabValue}
        onChange={(_, v) => setTabValue(v)}
        sx={{ mb: 3, '& .MuiTabs-indicator': { borderRadius: 1 } }}
      >
        <Tab label="Финансы" />
        <Tab label="Продуктивность" />
        <Tab label="Корреляция" />
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        <Card sx={{ mb: 2.5 }}>
          <CardContent>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
              Период отчёта
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} flexWrap="wrap" useFlexGap>
              <TextField
                label="С"
                type="date"
                size="small"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 160 }}
              />
              <TextField
                label="По"
                type="date"
                size="small"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 160 }}
              />
              <Button variant="contained" onClick={applyDateRange} disabled={financeLoading}>
                Показать
              </Button>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label="Текущий месяц" size="small" onClick={setCurrentMonth} clickable variant="outlined" />
                <Chip label="Прошлый месяц" size="small" onClick={setPrevMonth} clickable variant="outlined" />
              </Stack>
            </Stack>
            {rangeError && (
              <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 1 }}>
                {rangeError}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
              {formatDateRangeRu(appliedFrom, appliedTo)}
            </Typography>
          </CardContent>
        </Card>

        {financeLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : (
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    Расходы по категориям (₽)
                  </Typography>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={3} dataKey="value">
                          {pieData.map((_, idx) => (
                            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: '#1E293B', border: '1px solid rgba(148, 163, 184, 0.12)', borderRadius: 8 }}
                          formatter={(value: number) => formatMoney(value, displayCurrency)}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 10 }}>Нет данных за период</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    Доходы / Расходы по дням (₽)
                  </Typography>
                  {barData.some((d) => d.Доходы > 0 || d.Расходы > 0) ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                        <XAxis
                          dataKey="label"
                          stroke="#94A3B8"
                          fontSize={11}
                          interval={barTickInterval}
                          angle={barData.length > 14 ? -45 : 0}
                          textAnchor={barData.length > 14 ? 'end' : 'middle'}
                          height={barData.length > 14 ? 50 : 30}
                        />
                        <YAxis stroke="#94A3B8" fontSize={12} />
                        <Tooltip
                          contentStyle={{ background: '#1E293B', border: '1px solid rgba(148, 163, 184, 0.12)', borderRadius: 8 }}
                          formatter={(value: number) => formatMoney(value, displayCurrency)}
                          labelFormatter={(_, payload) => {
                            const item = payload?.[0]?.payload as { date?: string } | undefined;
                            return item?.date ? formatSingleDateRu(item.date) : '';
                          }}
                        />
                        <Bar dataKey="Доходы" fill="#10B981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Расходы" fill="#EF4444" radius={[4, 4, 0, 0]} />
                        <Legend />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 10 }}>Нет данных за период</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    Динамика баланса
                  </Typography>
                  {balanceHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={balanceHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                        <XAxis
                          dataKey="label"
                          stroke="#94A3B8"
                          fontSize={11}
                          interval={balanceHistory.length > 45 ? Math.floor(balanceHistory.length / 20) : balanceHistory.length > 20 ? 2 : 0}
                          angle={balanceHistory.length > 14 ? -45 : 0}
                          textAnchor={balanceHistory.length > 14 ? 'end' : 'middle'}
                          height={balanceHistory.length > 14 ? 50 : 30}
                        />
                        <YAxis stroke="#94A3B8" fontSize={12} />
                        <Tooltip
                          contentStyle={{ background: '#1E293B', border: '1px solid rgba(148, 163, 184, 0.12)', borderRadius: 8 }}
                          formatter={(value: number, name: string) => [formatMoney(value, name), name]}
                        />
                        <Legend />
                        {balanceCurrencies.map((currency, idx) => (
                          <Line
                            key={currency}
                            type="monotone"
                            dataKey={currency}
                            name={currency}
                            stroke={CURRENCY_LINE_COLORS[currency] || COLORS[idx % COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 10 }}>Нет данных за период</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={2.5}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">Задач выполнено</Typography>
                <Typography variant="h3" sx={{ fontWeight: 700, color: 'success.main', my: 1 }}>
                  {totalTasksCompleted}
                </Typography>
                <Typography variant="caption" color="text.secondary">за период</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">Среднее в день</Typography>
                <Typography variant="h3" sx={{ fontWeight: 700, color: 'warning.main', my: 1 }}>
                  {avgTasksPerDay}
                </Typography>
                <Typography variant="caption" color="text.secondary">задач</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">Отчётов</Typography>
                <Typography variant="h3" sx={{ fontWeight: 700, color: 'primary.main', my: 1 }}>
                  {productivityReports.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">записей</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">Корреляция</Typography>
                <Typography variant="h3" sx={{ fontWeight: 700, color: 'info.main', my: 1 }}>
                  {(latestCorrelation * 100).toFixed(0)}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                  Задачи и расходы по дням
                </Typography>
                {productivityChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={productivityChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                      <XAxis dataKey="date" stroke="#94A3B8" fontSize={12} />
                      <YAxis stroke="#94A3B8" fontSize={12} />
                      <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid rgba(148, 163, 184, 0.12)', borderRadius: 8 }} />
                      <Bar dataKey="tasks" fill="#2563EB" radius={[4, 4, 0, 0]} name="Задачи" />
                      <Bar dataKey="expenses" fill="#EF4444" radius={[4, 4, 0, 0]} name="Расходы" />
                      <Legend />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 8 }}>Нет данных</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                  Задачи vs Расходы
                </Typography>
                {scatterData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={scatterData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                      <XAxis dataKey="date" stroke="#94A3B8" fontSize={12} />
                      <YAxis yAxisId="left" stroke="#2563EB" fontSize={12} />
                      <YAxis yAxisId="right" orientation="right" stroke="#EF4444" fontSize={12} />
                      <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid rgba(148, 163, 184, 0.12)', borderRadius: 8 }} />
                      <Line yAxisId="left" type="monotone" dataKey="productivity_score" stroke="#2563EB" name="Задачи" />
                      <Line yAxisId="right" type="monotone" dataKey="expenses" stroke="#EF4444" name="Расходы" />
                      <Legend />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 12 }}>Нет данных</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card
              sx={{
                background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(124, 58, 237, 0.08))',
                border: '1px solid rgba(37, 99, 235, 0.15)',
                height: '100%',
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Lightbulb sx={{ color: '#F59E0B' }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    AI Аналитика
                  </Typography>
                </Box>
                {insightText ? (
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {insightText}
                  </Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                    Нет инсайтов
                  </Typography>
                )}
                {correlation && (
                  <Chip
                    label={`Корреляция: ${(correlation.correlation_score * 100).toFixed(0)}%`}
                    size="small"
                    sx={{ mt: 2 }}
                  />
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
    </motion.div>
  );
}
