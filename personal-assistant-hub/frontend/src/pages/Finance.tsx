import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  LinearProgress,
  Chip,
  Grid,
  IconButton,
  InputAdornment,
  CircularProgress,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  Divider,
} from '@mui/material';
import { Add, Edit, Delete, Search, AccountBalance, Category, Description, CalendarMonth, Savings, ExpandMore } from '@mui/icons-material';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line,
} from 'recharts';
import { motion } from 'framer-motion';
import { financeApi, type Account, type Category, type Transaction, type Budget, type FinanceReport, type BalanceHistorySeries } from '../api/finance';
import { currencySymbol, formatMoney } from '../utils/currency';
import {
  buildExpenseBreakdownRub,
  buildMonthlyFlowRub,
  formatStatsPeriodRange,
  getStatsDateRange,
  getStatsPeriodDescription,
  getBudgetQueryParams,
  getBalanceHistoryDays,
  isMonthInStatsPeriod,
  type StatsPeriod,
} from '../utils/financeStats';
import { useToast } from '../store/toastStore';

const apiErrorMessage = (err: unknown, fallback: string) => {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg || String(d)).join(', ');
  return fallback;
};

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

const CURRENCY_LINE_COLORS: Record<string, string> = {
  RUB: '#2563EB',
  USD: '#10B981',
  EUR: '#F59E0B',
  GBP: '#8B5CF6',
};

const STATS_PERIOD_OPTIONS: { value: StatsPeriod; label: string }[] = [
  { value: 'month', label: 'Текущий месяц' },
  { value: 'prev_month', label: 'Прошлый месяц' },
  { value: 'quarter', label: '3 месяца' },
];

const MONTH_NAMES = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];

const formatMonthHeader = (yearMonth: string) => {
  const [year, month] = yearMonth.split('-');
  const idx = parseInt(month, 10) - 1;
  if (idx < 0 || idx > 11) return yearMonth;
  const name = MONTH_NAMES[idx];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
};

const groupTransactionsByMonth = (txs: Transaction[]) => {
  const groups: Record<string, Transaction[]> = {};
  txs.forEach((tx) => {
    const key = tx.date?.slice(0, 7) || '0000-00';
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  });
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, items]) => ({
      key,
      label: formatMonthHeader(key),
      items: items.sort((a, b) => b.date.localeCompare(a.date)),
    }));
};

const getBudgetUsagePercent = (spent: number, limit: number) =>
  limit > 0 ? (spent / limit) * 100 : 0;

const getBudgetBarColor = (percent: number): string => {
  if (percent >= 81) return '#EF4444';
  if (percent >= 46) return '#F59E0B';
  return '#10B981';
};

const normalizeCategoryType = (type: string) => type.toLowerCase();

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  return value === index ? <motion.div variants={itemVariants} initial="hidden" animate="visible">{children}</motion.div> : null;
}

export default function Finance() {
  const { showError, showSuccess } = useToast();
  const [tabValue, setTabValue] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [report, setReport] = useState<FinanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [txDialog, setTxDialog] = useState(false);
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [txAmount, setTxAmount] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txAccountId, setTxAccountId] = useState<number | ''>('');
  const [txCategoryId, setTxCategoryId] = useState<number | null>(null);
  const [txRecurring, setTxRecurring] = useState(false);
  const [txRecurringDay, setTxRecurringDay] = useState(String(new Date().getDate()));
  const [categories, setCategories] = useState<Category[]>([]);
  const [txSubmitting, setTxSubmitting] = useState(false);

  const [accountDialog, setAccountDialog] = useState(false);
  const [accountForm, setAccountForm] = useState({ name: '', type: 'bank', balance: '', currency: 'RUB' });
  const [accountSubmitting, setAccountSubmitting] = useState(false);

  const [budgetDialog, setBudgetDialog] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ category_id: '' as string | number, limit_amount: '', period: 'monthly' });
  const [budgetSubmitting, setBudgetSubmitting] = useState(false);

  const [editAccountDialog, setEditAccountDialog] = useState(false);
  const [editAccountForm, setEditAccountForm] = useState<Account | null>(null);

  const [editTxDialog, setEditTxDialog] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);

  const [catDialog, setCatDialog] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', type: 'expense' as 'income' | 'expense', color: '#2563EB' });
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>('month');
  const [catFilter, setCatFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [balanceHistory, setBalanceHistory] = useState<Array<{ date: string } & Record<string, number | string>>>([]);
  const [balanceCurrencies, setBalanceCurrencies] = useState<string[]>([]);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  const getCategoryName = (catId: number) => categories.find(c => c.id === catId)?.name || 'Без категории';
  const getAccountName = (accountId: number) => accounts.find(a => a.id === accountId)?.name || '—';
  const getAccountCurrency = (accountId: number) =>
    accounts.find(a => a.id === accountId)?.currency ||
    transactions.find(t => t.account_id === accountId)?.account_currency ||
    'RUB';

  const resolveTxCurrency = useCallback(
    (tx: Transaction) => tx.account_currency || getAccountCurrency(tx.account_id),
    [accounts, transactions],
  );

  const pieData = useMemo(
    () => buildExpenseBreakdownRub(transactions, statsPeriod, resolveTxCurrency),
    [transactions, statsPeriod, resolveTxCurrency],
  );

  const barData = useMemo(
    () => buildMonthlyFlowRub(transactions, statsPeriod, resolveTxCurrency),
    [transactions, statsPeriod, resolveTxCurrency],
  );

  const barChartHasValues = useMemo(
    () => barData.some((row) => row.Доходы > 0 || row.Расходы > 0),
    [barData],
  );

  const selectedTxAccount = accounts.find((a) => a.id === txAccountId);
  const txCurrency = selectedTxAccount?.currency || 'RUB';
  const editTxCurrency = editTx
    ? getAccountCurrency(editTx.account_id)
    : 'RUB';

  const openTxDialog = () => {
    resetTxForm();
    if (accounts.length === 1) {
      setTxAccountId(accounts[0].id);
    }
    setTxDialog(true);
  };

  const fetchData = (period: StatsPeriod = statsPeriod) => {
    setLoading(true);
    const balanceDays = getBalanceHistoryDays(period);

    Promise.allSettled([
      financeApi.getAccounts(),
      financeApi.getTransactions({ per_page: 500 }),
      financeApi.getBudgets(getBudgetQueryParams(period)),
      financeApi.getReports(),
      financeApi.getCategories(),
      financeApi.getBalanceHistory(balanceDays),
    ]).then((results) => {
      const get = <T,>(idx: number): T | null =>
        results[idx].status === 'fulfilled' ? (results[idx] as PromiseFulfilledResult<{ data: T }>).value.data : null;

      const accountsData = get<Account[]>(0);
      const txData = get<Transaction[]>(1);
      const budgetsData = get<Budget[]>(2);
      const reportData = get<FinanceReport>(3);
      const categoriesData = get<Category[]>(4);
      const balanceData = get<BalanceHistorySeries[]>(5);

      if (accountsData) setAccounts(accountsData);
      if (txData) setTransactions(txData);
      else setTransactions([]);
      if (budgetsData) setBudgets(budgetsData);
      if (reportData) setReport(reportData);
      if (categoriesData) setCategories(categoriesData);
      if (balanceData && balanceData.length > 0) {
        const currencies = balanceData.map((s) => s.currency);
        setBalanceCurrencies(currencies);
        const byDate: Record<string, { date: string } & Record<string, number | string>> = {};
        balanceData.forEach((series) => {
          series.points.forEach((point) => {
            const label = point.date.slice(5);
            if (!byDate[label]) byDate[label] = { date: label };
            byDate[label][series.currency] = Number(point.balance);
          });
        });
        setBalanceHistory(Object.values(byDate));
      } else {
        setBalanceCurrencies([]);
        setBalanceHistory([]);
      }
      setLoading(false);
    });
  };

  const resetTxForm = () => {
    setTxType('expense');
    setTxAmount('');
    setTxDescription('');
    setTxDate(new Date().toISOString().split('T')[0]);
    setTxAccountId('');
    setTxCategoryId(null);
    setTxRecurring(false);
    setTxRecurringDay(String(new Date().getDate()));
  };

  const handleTxSubmit = async () => {
    if (!txAmount || !txAccountId) return;
    setTxSubmitting(true);
    try {
      await financeApi.createTransaction({
        account_id: txAccountId as number,
        category_id: txCategoryId,
        amount: parseFloat(txAmount),
        description: txDescription || '',
        transaction_type: txType,
        date: txDate,
        is_recurring: txType === 'expense' && txRecurring,
        recurring_day: txType === 'expense' && txRecurring ? parseInt(txRecurringDay, 10) : undefined,
      });
      setTxDialog(false);
      resetTxForm();
      fetchData();
      showSuccess('Транзакция создана');
    } catch (err: unknown) {
      showError(apiErrorMessage(err, 'Не удалось создать транзакцию'));
    }
    setTxSubmitting(false);
  };

  const handleAccountSubmit = async () => {
    if (!accountForm.name) return;
    setAccountSubmitting(true);
    try {
      await financeApi.createAccount({ name: accountForm.name, type: accountForm.type, balance: parseFloat(accountForm.balance || '0'), currency: accountForm.currency });
      setAccountDialog(false);
      setAccountForm({ name: '', type: 'bank', balance: '', currency: 'RUB' });
      fetchData();
      showSuccess('Счёт создан');
    } catch (err: unknown) {
      showError(apiErrorMessage(err, 'Не удалось создать счёт'));
    }
    setAccountSubmitting(false);
  };

  const handleBudgetSubmit = async () => {
    if (!budgetForm.limit_amount || !budgetForm.category_id) return;
    setBudgetSubmitting(true);
    try {
      await financeApi.createBudget({
        category_id: Number(budgetForm.category_id),
        limit_amount: parseFloat(budgetForm.limit_amount),
        period: budgetForm.period as 'monthly',
      });
      setBudgetDialog(false);
      setBudgetForm({ category_id: '', limit_amount: '', period: 'monthly' });
      fetchData();
      showSuccess('Бюджет создан');
    } catch (err: unknown) {
      showError(apiErrorMessage(err, 'Не удалось создать бюджет'));
    }
    setBudgetSubmitting(false);
  };

  const handleDeleteBudget = async (budget: Budget) => {
    const name = budget.category_name || getCategoryName(budget.category_id);
    if (!window.confirm(`Удалить бюджет «${name}»?`)) return;
    try {
      await financeApi.deleteBudget(budget.id);
      fetchData();
      showSuccess('Бюджет удалён');
    } catch (err: unknown) {
      showError(apiErrorMessage(err, 'Не удалось удалить бюджет'));
    }
  };

  const budgetCategoryOptions = categories.filter(
    (c) =>
      normalizeCategoryType(c.type) === 'expense' &&
      !budgets.some((b) => b.category_id === c.id && b.period === budgetForm.period)
  );

  const handleEditAccount = async () => {
    if (!editAccountForm || !editAccountForm.name) return;
    try {
      await financeApi.updateAccount(editAccountForm.id, {
        name: editAccountForm.name,
        type: editAccountForm.type,
        currency: editAccountForm.currency,
      });
      setEditAccountDialog(false);
      setEditAccountForm(null);
      fetchData();
      showSuccess('Счёт обновлён');
    } catch (err: unknown) {
      showError(apiErrorMessage(err, 'Не удалось обновить счёт'));
    }
  };

  const handleEditTx = async () => {
    if (!editTx) return;
    try {
      await financeApi.updateTransaction(editTx.id, {
        account_id: editTx.account_id,
        amount: editTx.amount,
        description: editTx.description,
        category_id: editTx.category_id,
        transaction_type: editTx.transaction_type,
        date: editTx.date,
      });
      setEditTxDialog(false);
      setEditTx(null);
      fetchData();
      showSuccess('Транзакция обновлена');
    } catch (err: unknown) {
      showError(apiErrorMessage(err, 'Не удалось обновить транзакцию'));
    }
  };

  const handleAddCategory = async () => {
    if (!catForm.name.trim()) return;
    try {
      await financeApi.createCategory({ name: catForm.name, type: catForm.type, color: catForm.color });
      setCatForm({ name: '', type: 'expense', color: '#2563EB' });
      fetchData();
      showSuccess('Категория создана');
    } catch (err: unknown) {
      showError(apiErrorMessage(err, 'Не удалось создать категорию'));
    }
  };

  const handleUpdateCategory = async () => {
    if (!editCat || !editCat.name.trim()) return;
    try {
      await financeApi.updateCategory(editCat.id, {
        name: editCat.name,
        type: editCat.type,
        color: editCat.color,
      });
      setEditCat(null);
      fetchData();
      showSuccess('Категория обновлена');
    } catch (err: unknown) {
      showError(apiErrorMessage(err, 'Не удалось обновить категорию'));
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    if (!window.confirm(`Удалить категорию «${category.name}»? Транзакции останутся без категории.`)) return;
    try {
      await financeApi.deleteCategory(category.id);
      if (editCat?.id === category.id) setEditCat(null);
      fetchData();
      showSuccess('Категория удалена');
    } catch (err: unknown) {
      showError(apiErrorMessage(err, 'Не удалось удалить категорию'));
    }
  };

  useEffect(() => { fetchData(statsPeriod); }, [statsPeriod]);

  const filteredTransactions = transactions.filter((tx) =>
    (tx.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (tx.category_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const transactionGroups = groupTransactionsByMonth(filteredTransactions);

  const getMonthTotalsByCurrency = (items: Transaction[]) => {
    const totals: Record<string, { income: number; expense: number }> = {};
    items.forEach((tx) => {
      const currency = tx.account_currency || getAccountCurrency(tx.account_id);
      if (!totals[currency]) totals[currency] = { income: 0, expense: 0 };
      const amount = Number(tx.amount);
      if (tx.transaction_type === 'income') totals[currency].income += amount;
      else totals[currency].expense += amount;
    });
    return Object.entries(totals).sort(([a], [b]) => a.localeCompare(b));
  };

  const toggleMonthCollapsed = (monthKey: string) => {
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

  return (
    <motion.div initial="hidden" animate="visible" variants={itemVariants}>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>Финансы</Typography>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2,
          p: 2,
          borderRadius: 2,
          bgcolor: 'rgba(148, 163, 184, 0.06)',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Период статистики
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {formatStatsPeriodRange(statsPeriod)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {getStatsPeriodDescription(statsPeriod)}
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Период</InputLabel>
          <Select
            value={statsPeriod}
            label="Период"
            onChange={(e) => setStatsPeriod(e.target.value as StatsPeriod)}
          >
            {STATS_PERIOD_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Tabs
        value={tabValue}
        onChange={(_, v) => setTabValue(v)}
        sx={{ mb: 3, '& .MuiTabs-indicator': { borderRadius: 1 } }}
      >
        <Tab label="Счета" />
        <Tab label="Транзакции" />
        <Tab label="Бюджеты" />
        <Tab label="Графики" />
      </Tabs>

      {/* Accounts Tab */}
      <TabPanel value={tabValue} index={0}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Счета</Typography>
              <Button variant="contained" startIcon={<Add />} size="small" onClick={() => setAccountDialog(true)}>
                Добавить счёт
              </Button>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Название</TableCell>
                    <TableCell>Тип</TableCell>
                    <TableCell align="right">Баланс</TableCell>
                    <TableCell>Валюта</TableCell>
                    <TableCell width={50}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell sx={{ fontWeight: 500 }}>{account.name}</TableCell>
                      <TableCell>
                        <Chip
                          label={account.type === 'credit' ? 'Кредитная' : account.type === 'debit' ? 'Дебетовая' : account.type}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          sx={{ fontWeight: 600, color: Number(account.balance) >= 0 ? 'success.main' : 'error.main' }}
                        >
                          {formatMoney(Number(account.balance), account.currency)}
                        </Typography>
                      </TableCell>
                      <TableCell>{account.currency || 'RUB'}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => { setEditAccountForm(account); setEditAccountDialog(true); }}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {accounts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                          Нет счетов
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Transactions Tab */}
      <TabPanel value={tabValue} index={1}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="Поиск транзакций..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ minWidth: 280 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>
                  ),
                }}
              />
              <Button variant="contained" startIcon={<Add />} size="small" onClick={openTxDialog}>
                Добавить
              </Button>
              <Button variant="outlined" startIcon={<Category />} size="small" onClick={() => setCatDialog(true)}>
                Категории
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Все операции по месяцам. Графики и статистика — за период: {formatStatsPeriodRange(statsPeriod)}.
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Дата</TableCell>
                    <TableCell>Счёт</TableCell>
                    <TableCell>Категория</TableCell>
                    <TableCell>Описание</TableCell>
                    <TableCell align="right">Сумма</TableCell>
                    <TableCell width={50}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactionGroups.map((group) => {
                    const currencyTotals = getMonthTotalsByCurrency(group.items);
                    const isCollapsed = collapsedMonths.has(group.key);
                    const inStatsPeriod = isMonthInStatsPeriod(group.key, statsPeriod);
                    return (
                      <Fragment key={group.key}>
                        <TableRow
                          hover
                          onClick={() => toggleMonthCollapsed(group.key)}
                          sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'rgba(148, 163, 184, 0.06)' } }}
                        >
                          <TableCell
                            colSpan={6}
                            sx={{
                              py: 0,
                              px: 0,
                              borderBottom: 'none',
                              bgcolor: 'transparent',
                            }}
                          >
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 2,
                                mt: group.key === transactionGroups[0]?.key ? 0 : 2,
                                mb: 1,
                                px: 1,
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
                                <ExpandMore
                                  sx={{
                                    color: 'text.secondary',
                                    fontSize: 22,
                                    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s ease',
                                  }}
                                />
                                <CalendarMonth sx={{ color: 'primary.main', fontSize: 20, ml: 0.5 }} />
                                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                  {group.label}
                                </Typography>
                                <Chip
                                  label={`${group.items.length} ${group.items.length === 1 ? 'операция' : group.items.length < 5 ? 'операции' : 'операций'}`}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: 11 }}
                                />
                                {!inStatsPeriod && (
                                  <Chip
                                    label="не в периоде статистики"
                                    size="small"
                                    sx={{ fontSize: 10, color: 'text.secondary' }}
                                  />
                                )}
                              </Box>
                              <Box sx={{ display: 'flex', gap: 2, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                {currencyTotals.map(([currency, totals]) => (
                                  <Box key={currency} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                    {currencyTotals.length > 1 && (
                                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                        {currency}:
                                      </Typography>
                                    )}
                                    {totals.income > 0 && (
                                      <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
                                        +{formatMoney(totals.income, currency)}
                                      </Typography>
                                    )}
                                    {totals.expense > 0 && (
                                      <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600 }}>
                                        −{formatMoney(totals.expense, currency)}
                                      </Typography>
                                    )}
                                  </Box>
                                ))}
                              </Box>
                            </Box>
                            <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.2)' }} />
                          </TableCell>
                        </TableRow>
                        {!isCollapsed && group.items.map((tx) => (
                          <TableRow
                            key={tx.id}
                            sx={{
                              '&:hover': { bgcolor: 'rgba(148, 163, 184, 0.04)' },
                              '& td': { borderBottom: '1px solid rgba(148, 163, 184, 0.08)' },
                            }}
                          >
                            <TableCell sx={{ pl: 3, whiteSpace: 'nowrap' }}>
                              {new Date(tx.date.slice(0, 10)).toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </TableCell>
                            <TableCell>{tx.account_name || getAccountName(tx.account_id)}</TableCell>
                            <TableCell>
                              <Chip
                                label={tx.category_name || 'Без категории'}
                                size="small"
                                sx={{
                                  bgcolor: tx.category_color ? `${tx.category_color}20` : undefined,
                                  color: tx.category_color || undefined,
                                }}
                              />
                            </TableCell>
                            <TableCell>{tx.description}</TableCell>
                            <TableCell align="right">
                              <Typography
                                sx={{
                                  fontWeight: 600,
                                  color: tx.transaction_type === 'income' ? 'success.main' : 'error.main',
                                }}
                              >
                                {tx.transaction_type === 'income' ? '+' : '−'}
                                {formatMoney(
                                  Number(tx.amount),
                                  tx.account_currency || getAccountCurrency(tx.account_id),
                                )}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <IconButton
                                size="small"
                                onClick={() => { setEditTx(tx); setEditTxDialog(true); }}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    );
                  })}
                  {filteredTransactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                          Нет транзакций
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Budgets Tab */}
      <TabPanel value={tabValue} index={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Расчёт за период: {formatStatsPeriodRange(statsPeriod)}
          </Typography>
          <Button variant="contained" startIcon={<Add />} size="small" onClick={() => setBudgetDialog(true)}>
            Добавить бюджет
          </Button>
        </Box>
        <Grid container spacing={2}>
          {budgets.map((budget) => {
            const spent = Number(budget.spent_amount);
            const limit = Number(budget.limit_amount);
            const usagePercent = getBudgetUsagePercent(spent, limit);
            const barPercent = Math.min(usagePercent, 100);
            const isOver = spent > limit;
            const categoryName = budget.category_name || getCategoryName(budget.category_id);
            const barColor = getBudgetBarColor(usagePercent);
            return (
              <Grid item xs={12} sm={6} md={4} key={budget.id}>
                <motion.div variants={itemVariants}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                          <Box
                            sx={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              bgcolor: budget.category_color || '#2563EB',
                              flexShrink: 0,
                            }}
                          />
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                            {categoryName}
                          </Typography>
                        </Box>
                        <IconButton size="small" color="error" onClick={() => handleDeleteBudget(budget)} aria-label="Удалить бюджет">
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                      <Chip
                        label={STATS_PERIOD_OPTIONS.find((o) => o.value === statsPeriod)?.label || statsPeriod}
                        size="small"
                        variant="outlined"
                        sx={{ mb: 1, fontSize: 10 }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        Период: {formatStatsPeriodRange(statsPeriod)}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Потрачено
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {formatMoney(spent, 'RUB')}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Лимит{statsPeriod === 'quarter' ? ' (×3 мес.)' : ''}
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {formatMoney(limit, 'RUB')}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={barPercent}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          bgcolor: 'rgba(148, 163, 184, 0.12)',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: barColor,
                            borderRadius: 4,
                          },
                        }}
                      />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                        <Typography
                          variant="caption"
                          sx={{ color: isOver ? 'error.main' : 'text.secondary' }}
                        >
                          {usagePercent.toFixed(0)}% от лимита
                        </Typography>
                        {isOver && (
                          <Typography variant="caption" color="error.main" sx={{ fontWeight: 600 }}>
                            Превышение на {formatMoney(spent - limit, 'RUB')}!
                          </Typography>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            );
          })}
          {budgets.length === 0 && (
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                Нет бюджетов
              </Typography>
            </Grid>
          )}
        </Grid>
      </TabPanel>

      {/* Charts Tab */}
      <TabPanel value={tabValue} index={3}>
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Расходы по категориям (₽)
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  {formatStatsPeriodRange(statsPeriod)}
                </Typography>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                        {pieData.map((_, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#1E293B', border: '1px solid rgba(148, 163, 184, 0.12)', borderRadius: 8 }}
                        formatter={(value: number) => formatMoney(value, 'RUB')}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 8 }}>Нет данных</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                  Доходы / Расходы по месяцам
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  {formatStatsPeriodRange(statsPeriod)}
                </Typography>
                {barData.length > 0 ? (
                  <>
                    {!barChartHasValues && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Нет операций за выбранный период
                      </Typography>
                    )}
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                        <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} />
                        <YAxis stroke="#94A3B8" fontSize={12} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{ background: '#1E293B', border: '1px solid rgba(148, 163, 184, 0.12)', borderRadius: 8 }}
                          formatter={(value: number) => formatMoney(Number(value), 'RUB')}
                        />
                        <Bar dataKey="Доходы" fill="#10B981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Расходы" fill="#EF4444" radius={[4, 4, 0, 0]} />
                        <Legend />
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 8 }}>Нет данных</Typography>
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
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={balanceHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                      <XAxis dataKey="date" stroke="#94A3B8" fontSize={12} />
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
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 8 }}>
                    Нет данных
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <Dialog open={txDialog} onClose={() => { setTxDialog(false); resetTxForm(); }} maxWidth="sm" fullWidth>
        <DialogTitle>Новая транзакция</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Тип</InputLabel>
              <Select
                value={txType}
                label="Тип"
                onChange={(e) => {
                  setTxType(e.target.value as 'income' | 'expense');
                  setTxCategoryId(null);
                }}
              >
                <MenuItem value="expense">Расход</MenuItem>
                <MenuItem value="income">Доход</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small" required>
              <InputLabel>Счёт</InputLabel>
              <Select
                value={txAccountId}
                label="Счёт"
                onChange={(e) => setTxAccountId(e.target.value === '' ? '' : Number(e.target.value))}
              >
                {accounts.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.name} ({formatMoney(Number(a.balance), a.currency)})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel id="tx-category-label">Категория</InputLabel>
              <Select
                labelId="tx-category-label"
                value={txCategoryId ?? 'none'}
                label="Категория"
                onChange={(e) => {
                  const val = e.target.value;
                  setTxCategoryId(val === 'none' ? null : Number(val));
                }}
              >
                <MenuItem value="none">Без категории</MenuItem>
                {categories
                  .filter((c) => normalizeCategoryType(c.type) === txType)
                  .map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
              </Select>
            </FormControl>
            <TextField
              label="Сумма"
              type="number"
              value={txAmount}
              onChange={(e) => setTxAmount(e.target.value)}
              fullWidth
              helperText={txAccountId ? `Валюта счёта: ${txCurrency}` : 'Сначала выберите счёт'}
              InputProps={{
                startAdornment: <InputAdornment position="start">{currencySymbol(txCurrency)}</InputAdornment>,
              }}
            />
            <TextField
              label="Описание"
              value={txDescription}
              onChange={(e) => setTxDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="Дата"
              type="date"
              value={txDate}
              onChange={(e) => setTxDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            {txType === 'expense' && (
              <>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={txRecurring}
                      onChange={(e) => setTxRecurring(e.target.checked)}
                    />
                  }
                  label="Регулярный платёж"
                />
                {txRecurring && (
                  <TextField
                    label="День месяца"
                    type="number"
                    inputProps={{ min: 1, max: 31 }}
                    value={txRecurringDay}
                    onChange={(e) => setTxRecurringDay(e.target.value)}
                    fullWidth
                    helperText="Создаст напоминание-задачу об оплате"
                  />
                )}
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setTxDialog(false); resetTxForm(); }}>Отмена</Button>
          <Button variant="contained" onClick={handleTxSubmit} disabled={txSubmitting || !txAmount || !txAccountId || accounts.length === 0}>
            {txSubmitting ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={accountDialog} onClose={() => setAccountDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Новый счёт</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Название" fullWidth value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} />
            <Select value={accountForm.type} onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value })} size="small" fullWidth>
              <MenuItem value="bank">Банковский</MenuItem>
              <MenuItem value="cash">Наличные</MenuItem>
              <MenuItem value="card">Карта</MenuItem>
              <MenuItem value="savings">Сбережения</MenuItem>
            </Select>
            <FormControl fullWidth size="small">
              <InputLabel>Валюта</InputLabel>
              <Select
                value={accountForm.currency}
                label="Валюта"
                onChange={(e) => setAccountForm({ ...accountForm, currency: e.target.value })}
              >
                <MenuItem value="RUB">RUB — рубль (₽)</MenuItem>
                <MenuItem value="USD">USD — доллар ($)</MenuItem>
                <MenuItem value="EUR">EUR — евро (€)</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Начальный баланс" type="number" fullWidth value={accountForm.balance}
              onChange={(e) => setAccountForm({ ...accountForm, balance: e.target.value })}
              InputProps={{ startAdornment: <InputAdornment position="start">{currencySymbol(accountForm.currency)}</InputAdornment> }} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAccountDialog(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleAccountSubmit} disabled={accountSubmitting || !accountForm.name}>
            {accountSubmitting ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={budgetDialog} onClose={() => setBudgetDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Новый бюджет</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Select value={budgetForm.category_id} onChange={(e) => setBudgetForm({ ...budgetForm, category_id: e.target.value })} size="small" fullWidth displayEmpty>
              <MenuItem value="" disabled>Выберите категорию расхода</MenuItem>
              {budgetCategoryOptions.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c.color || '#2563EB' }} />
                    {c.name}
                  </Box>
                </MenuItem>
              ))}
            </Select>
            {budgetCategoryOptions.length === 0 && (
              <Typography variant="caption" color="text.secondary">
                Все категории расходов уже имеют бюджет на этот период
              </Typography>
            )}
            <TextField label="Лимит (макс. сумма расходов, ₽)" type="number" fullWidth value={budgetForm.limit_amount}
              onChange={(e) => setBudgetForm({ ...budgetForm, limit_amount: e.target.value })}
              helperText="Максимум расходов по категории за период. Суммы из транзакций конвертируются в ₽." />
            <Select value={budgetForm.period} onChange={(e) => setBudgetForm({ ...budgetForm, period: e.target.value })} size="small" fullWidth>
              <MenuItem value="monthly">Ежемесячно</MenuItem>
              <MenuItem value="weekly">Еженедельно</MenuItem>
              <MenuItem value="yearly">Ежегодно</MenuItem>
            </Select>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBudgetDialog(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleBudgetSubmit} disabled={budgetSubmitting || !budgetForm.limit_amount || !budgetForm.category_id}>
            {budgetSubmitting ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editAccountDialog} onClose={() => setEditAccountDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Редактировать счёт</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Название" fullWidth value={editAccountForm?.name || ''}
              onChange={(e) => setEditAccountForm(editAccountForm ? { ...editAccountForm, name: e.target.value } : null)} />
            <Select value={editAccountForm?.type || 'bank'}
              onChange={(e) => setEditAccountForm(editAccountForm ? { ...editAccountForm, type: e.target.value } : null)}
              size="small" fullWidth>
              <MenuItem value="bank">Банковский</MenuItem>
              <MenuItem value="cash">Наличные</MenuItem>
              <MenuItem value="card">Карта</MenuItem>
              <MenuItem value="savings">Сбережения</MenuItem>
            </Select>
            <FormControl fullWidth size="small">
              <InputLabel>Валюта</InputLabel>
              <Select
                value={editAccountForm?.currency || 'RUB'}
                label="Валюта"
                onChange={(e) => setEditAccountForm(editAccountForm ? { ...editAccountForm, currency: e.target.value } : null)}
              >
                <MenuItem value="RUB">RUB — рубль (₽)</MenuItem>
                <MenuItem value="USD">USD — доллар ($)</MenuItem>
                <MenuItem value="EUR">EUR — евро (€)</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditAccountDialog(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleEditAccount}>Сохранить</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editTxDialog} onClose={() => setEditTxDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Редактировать транзакцию</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Тип</InputLabel>
              <Select
                value={editTx?.transaction_type || 'expense'}
                label="Тип"
                onChange={(e) => setEditTx(editTx ? { ...editTx, transaction_type: e.target.value as 'income' | 'expense' } : null)}
              >
                <MenuItem value="expense">Расход</MenuItem>
                <MenuItem value="income">Доход</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small" required>
              <InputLabel>Счёт</InputLabel>
              <Select
                value={editTx?.account_id || ''}
                label="Счёт"
                onChange={(e) => setEditTx(editTx ? { ...editTx, account_id: Number(e.target.value) } : null)}
              >
                {accounts.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.name} ({formatMoney(Number(a.balance), a.currency)})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel id="edit-tx-category-label">Категория</InputLabel>
              <Select
                labelId="edit-tx-category-label"
                value={editTx?.category_id ?? 'none'}
                label="Категория"
                onChange={(e) => {
                  const val = e.target.value;
                  setEditTx(editTx ? { ...editTx, category_id: val === 'none' ? null : Number(val) } : null);
                }}
              >
                <MenuItem value="none">Без категории</MenuItem>
                {categories.filter((c) => normalizeCategoryType(c.type) === editTx?.transaction_type).map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="Сумма" type="number" value={editTx?.amount || ''}
              onChange={(e) => setEditTx(editTx ? { ...editTx, amount: parseFloat(e.target.value) || 0 } : null)}
              fullWidth
              helperText={`Валюта счёта: ${editTxCurrency}`}
              InputProps={{ startAdornment: <InputAdornment position="start">{currencySymbol(editTxCurrency)}</InputAdornment> }} />
            <TextField label="Описание" value={editTx?.description || ''}
              onChange={(e) => setEditTx(editTx ? { ...editTx, description: e.target.value } : null)}
              fullWidth multiline rows={2} />
            <TextField label="Дата" type="date" value={editTx?.date?.slice(0, 10) || ''}
              onChange={(e) => setEditTx(editTx ? { ...editTx, date: e.target.value } : null)}
              fullWidth InputLabelProps={{ shrink: true }} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditTxDialog(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleEditTx}>Сохранить</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={catDialog} onClose={() => setCatDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Управление категориями</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button size="small" variant={catFilter === 'all' ? 'contained' : 'outlined'} onClick={() => setCatFilter('all')}>Все</Button>
            <Button size="small" variant={catFilter === 'income' ? 'contained' : 'outlined'} onClick={() => setCatFilter('income')}>Доходы</Button>
            <Button size="small" variant={catFilter === 'expense' ? 'contained' : 'outlined'} onClick={() => setCatFilter('expense')}>Расходы</Button>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3, maxHeight: 240, overflow: 'auto' }}>
            {categories
              .filter((c) => catFilter === 'all' || normalizeCategoryType(c.type) === catFilter)
              .map((c) => (
                <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1, bgcolor: 'rgba(148,163,184,0.05)' }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: c.color || '#2563EB' }} />
                  <Typography variant="body2" sx={{ flex: 1 }}>{c.name}</Typography>
                  <Chip label={normalizeCategoryType(c.type) === 'income' ? 'Доход' : 'Расход'} size="small" variant="outlined" sx={{ fontSize: 10 }} />
                  <IconButton size="small" onClick={() => setEditCat({ ...c })} aria-label="Редактировать">
                    <Edit fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDeleteCategory(c)} aria-label="Удалить">
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            {categories.length === 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                Нет категорий
              </Typography>
            )}
          </Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Новая категория</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <TextField label="Название" size="small" value={catForm.name}
              onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
            <Select size="small" value={catForm.type} onChange={(e) => setCatForm({ ...catForm, type: e.target.value as 'income' | 'expense' })}>
              <MenuItem value="expense">Расход</MenuItem>
              <MenuItem value="income">Доход</MenuItem>
            </Select>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {['#2563EB','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#F97316'].map((color) => (
                <Box key={color} onClick={() => setCatForm({ ...catForm, color })}
                  sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: color, cursor: 'pointer',
                    border: catForm.color === color ? '2px solid #fff' : '2px solid transparent' }} />
              ))}
            </Box>
            <Button variant="contained" size="small" onClick={handleAddCategory} disabled={!catForm.name.trim()}>
              Добавить
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCatDialog(false)}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editCat} onClose={() => setEditCat(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Редактировать категорию</DialogTitle>
        <DialogContent>
          {editCat && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField
                label="Название"
                size="small"
                value={editCat.name}
                onChange={(e) => setEditCat({ ...editCat, name: e.target.value })}
              />
              <Select
                size="small"
                value={normalizeCategoryType(editCat.type)}
                onChange={(e) => setEditCat({ ...editCat, type: e.target.value as 'income' | 'expense' })}
              >
                <MenuItem value="expense">Расход</MenuItem>
                <MenuItem value="income">Доход</MenuItem>
              </Select>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {['#2563EB','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#F97316'].map((color) => (
                  <Box
                    key={color}
                    onClick={() => setEditCat({ ...editCat, color })}
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      bgcolor: color,
                      cursor: 'pointer',
                      border: editCat.color === color ? '2px solid #fff' : '2px solid transparent',
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditCat(null)}>Отмена</Button>
          <Button variant="contained" onClick={handleUpdateCategory} disabled={!editCat?.name.trim()}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </motion.div>
  );
}
