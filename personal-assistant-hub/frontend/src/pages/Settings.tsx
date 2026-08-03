import { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  AccountBalance,
  Assignment,
  Email,
  ExpandMore,
  Logout,
  Notifications,
  Palette,
  Person,
  Repeat,
  Telegram,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/authStore';
import { useSettings } from '../store/settingsStore';
import PageHeader from '../components/PageHeader';
import { useToast } from '../store/toastStore';
import { useTranslation } from '../i18n/useTranslation';
import { startScreenLabel } from '../i18n/translations';
import {
  type PrimaryCurrency,
  type StartScreen,
  type UserSettings,
} from '../types/settings';
import {
  exportAllUserData,
  exportFinanceData,
  exportHabitsData,
  exportTasksData,
  type ExportFormat,
} from '../utils/exportData';
import { financeApi, type Account } from '../api/finance';
import { telegramApi, type TelegramStatus } from '../api/telegram';

const START_SCREENS: StartScreen[] = ['dashboard', 'finance', 'tasks', 'habits', 'calendar', 'analytics'];

function SettingSwitch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <FormControlLabel
      sx={{ alignItems: 'flex-start', mx: 0, mb: 1.5 }}
      control={<Switch checked={checked} onChange={(e) => onChange(e.target.checked)} sx={{ mt: 0.25 }} />}
      label={
        <Box>
          <Typography variant="body2">{label}</Typography>
          {description ? (
            <Typography variant="caption" color="text.secondary" display="block">
              {description}
            </Typography>
          ) : null}
        </Box>
      }
    />
  );
}

function SectionAccordion({
  icon,
  title,
  children,
  defaultExpanded,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '12px !important',
        mb: 2,
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {icon}
          <Typography fontWeight={600}>{title}</Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>{children}</AccordionDetails>
    </Accordion>
  );
}

function ExportModuleRow({
  label,
  disabled,
  onExport,
  csvLabel,
  excelLabel,
}: {
  label: string;
  disabled: boolean;
  onExport: (format: ExportFormat) => void;
  csvLabel: string;
  excelLabel: string;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
      <Typography variant="body2" sx={{ minWidth: 72, fontWeight: 500 }}>{label}</Typography>
      <Button size="small" variant="outlined" disabled={disabled} onClick={() => onExport('csv')}>
        {csvLabel}
      </Button>
      <Button size="small" variant="outlined" disabled={disabled} onClick={() => onExport('xlsx')}>
        {excelLabel}
      </Button>
    </Box>
  );
}

export default function Settings() {
  const { user, logout } = useAuth();
  const { settings, updateSettings, resetSettings } = useSettings();
  const { showSuccess, showError, showInfo } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [currencyDialogOpen, setCurrencyDialogOpen] = useState(false);
  const [pendingCurrency, setPendingCurrency] = useState<PrimaryCurrency | null>(null);
  const [currencySelectKey, setCurrencySelectKey] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [tgStatus, setTgStatus] = useState<TelegramStatus | null>(null);
  const [tgAccounts, setTgAccounts] = useState<Account[]>([]);
  const [tgDeepLink, setTgDeepLink] = useState<string | null>(null);
  const [tgLinkToken, setTgLinkToken] = useState<string | null>(null);
  const [tgBusy, setTgBusy] = useState(false);

  const loadTelegram = async () => {
    try {
      const [status, accountsRes] = await Promise.all([
        telegramApi.getStatus(),
        financeApi.getAccounts(),
      ]);
      setTgStatus(status);
      setTgAccounts(accountsRes.data);
    } catch {
      /* status may fail if service down */
    }
  };

  useEffect(() => {
    void loadTelegram();
  }, []);

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showSuccess(t('settings.telegramCopied'));
    } catch {
      showError(t('settings.telegramError'));
    }
  };

  const handleTelegramLink = async () => {
    setTgBusy(true);
    try {
      const token = await telegramApi.createLinkToken();
      setTgDeepLink(token.deep_link);
      setTgLinkToken(token.token);
      showSuccess(t('settings.telegramLinkCreated'));
    } catch {
      showError(t('settings.telegramError'));
    }
    setTgBusy(false);
  };

  const handleTelegramUnlink = async () => {
    setTgBusy(true);
    try {
      await telegramApi.unlink();
      setTgStatus((prev) =>
        prev
          ? { ...prev, linked: false, chat_id_masked: null, default_account_id: null }
          : prev,
      );
      setTgDeepLink(null);
      setTgLinkToken(null);
      showSuccess(t('settings.telegramUnlinked'));
    } catch {
      showError(t('settings.telegramError'));
    }
    setTgBusy(false);
  };

  const handleDefaultAccount = async (accountId: number | '') => {
    setTgBusy(true);
    try {
      const status = await telegramApi.updateSettings(accountId === '' ? null : accountId);
      setTgStatus(status);
    } catch {
      showError(t('settings.telegramError'));
    }
    setTgBusy(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleCurrencySelect = (value: PrimaryCurrency) => {
    if (value === settings.primaryCurrency) return;
    setPendingCurrency(value);
    setCurrencyDialogOpen(true);
  };

  const cancelCurrencyChange = () => {
    setCurrencyDialogOpen(false);
    setPendingCurrency(null);
    setCurrencySelectKey((k) => k + 1);
  };

  const confirmCurrencyChange = () => {
    if (pendingCurrency) {
      updateSettings({ primaryCurrency: pendingCurrency });
      showInfo(t('settings.currencyChanged'));
    }
    setCurrencyDialogOpen(false);
    setPendingCurrency(null);
  };

  const handleExport = async (type: 'all' | 'finance' | 'tasks' | 'habits', format: ExportFormat) => {
    setExporting(true);
    try {
      if (type === 'all') await exportAllUserData(format);
      else if (type === 'finance') await exportFinanceData(format);
      else if (type === 'tasks') await exportTasksData(format);
      else await exportHabitsData(format);
      showSuccess(t('settings.exportSuccess'));
    } catch {
      showError(t('settings.exportError'));
    }
    setExporting(false);
  };

  function patchNotify(
    key: 'notifyFinance' | 'notifyTasks' | 'notifyHabits',
    patch: Partial<UserSettings[typeof key]>,
  ) {
    updateSettings({ [key]: { ...settings[key], ...patch } });
  }

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto' }}>
      <PageHeader title={t('settings.title')} />

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            {t('settings.profile')}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Person color="primary" />
            <Box>
              <Typography variant="body2" color="text.secondary">{t('settings.name')}</Typography>
              <Typography variant="body1">{user?.username || '—'}</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Email color="primary" />
            <Box>
              <Typography variant="body2" color="text.secondary">{t('settings.email')}</Typography>
              <Typography variant="body1">{user?.email || '—'}</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <SectionAccordion icon={<AccountBalance color="primary" />} title={t('settings.finance')} defaultExpanded>
        <FormControl fullWidth size="small" sx={{ mb: 2 }} key={currencySelectKey}>
          <InputLabel>{t('settings.primaryCurrency')}</InputLabel>
          <Select
            label={t('settings.primaryCurrency')}
            value={settings.primaryCurrency}
            onChange={(e) => handleCurrencySelect(e.target.value as PrimaryCurrency)}
          >
            <MenuItem value="RUB">RUB — ₽</MenuItem>
            <MenuItem value="USD">USD — $</MenuItem>
            <MenuItem value="EUR">EUR — €</MenuItem>
            <MenuItem value="GBP">GBP — £</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>{t('settings.financialMonthStart')}</InputLabel>
          <Select
            label={t('settings.financialMonthStart')}
            value={settings.financialMonthStart}
            onChange={(e) => updateSettings({ financialMonthStart: Number(e.target.value) })}
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
              <MenuItem key={day} value={day}>{t('settings.dayOfMonth', { day })}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>{t('settings.balanceMode')}</InputLabel>
          <Select
            label={t('settings.balanceMode')}
            value={settings.balanceMode}
            onChange={(e) => updateSettings({ balanceMode: e.target.value as UserSettings['balanceMode'] })}
          >
            <MenuItem value="actual">{t('settings.balanceActual')}</MenuItem>
            <MenuItem value="budget">{t('settings.balanceBudget')}</MenuItem>
          </Select>
        </FormControl>

        <SettingSwitch
          label={t('settings.expenseReminder')}
          description={t('settings.expenseReminderHint')}
          checked={settings.expenseReminderEnabled}
          onChange={(v) => updateSettings({ expenseReminderEnabled: v })}
        />
        {settings.expenseReminderEnabled && (
          <TextField
            type="time"
            label={t('settings.reminderTime')}
            size="small"
            fullWidth
            value={settings.expenseReminderTime}
            onChange={(e) => updateSettings({ expenseReminderTime: e.target.value })}
            sx={{ mb: 2 }}
            InputLabelProps={{ shrink: true }}
          />
        )}

        <Divider sx={{ my: 2 }} />
        <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
          {t('settings.dashboardBlocks')}
        </Typography>
        <FormGroup>
          <SettingSwitch
            label={t('settings.showBalance')}
            checked={settings.dashboardShowBalance}
            onChange={(v) => updateSettings({ dashboardShowBalance: v })}
          />
          <SettingSwitch
            label={t('settings.showBudgets')}
            checked={settings.dashboardShowBudgets}
            onChange={(v) => updateSettings({ dashboardShowBudgets: v })}
          />
          <SettingSwitch
            label={t('settings.showTransactions')}
            checked={settings.dashboardShowTransactions}
            onChange={(v) => updateSettings({ dashboardShowTransactions: v })}
          />
        </FormGroup>
      </SectionAccordion>

      <SectionAccordion icon={<Assignment color="primary" />} title={t('settings.tasks')}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
          <TextField
            type="time"
            label={t('settings.workStart')}
            size="small"
            value={settings.workHoursStart}
            onChange={(e) => updateSettings({ workHoursStart: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            type="time"
            label={t('settings.workEnd')}
            size="small"
            value={settings.workHoursEnd}
            onChange={(e) => updateSettings({ workHoursEnd: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
        </Box>

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>{t('settings.weekStart')}</InputLabel>
          <Select
            label={t('settings.weekStart')}
            value={settings.weekStartDay}
            onChange={(e) => updateSettings({ weekStartDay: Number(e.target.value) as UserSettings['weekStartDay'] })}
          >
            <MenuItem value={1}>{t('settings.weekMon')}</MenuItem>
            <MenuItem value={0}>{t('settings.weekSun')}</MenuItem>
            <MenuItem value={6}>{t('settings.weekSat')}</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
          <TextField
            type="number"
            label={t('settings.defaultDuration')}
            size="small"
            value={settings.defaultTaskDuration}
            onChange={(e) => updateSettings({ defaultTaskDuration: Number(e.target.value) || 60 })}
            inputProps={{ min: 5, step: 5 }}
          />
          <TextField
            type="time"
            label={t('settings.defaultTaskTime')}
            size="small"
            value={settings.defaultTaskTime}
            onChange={(e) => updateSettings({ defaultTaskTime: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
        </Box>

        <TextField
          type="number"
          label={t('settings.defaultReminder')}
          size="small"
          fullWidth
          sx={{ mb: 2 }}
          value={settings.defaultReminderMinutes}
          onChange={(e) => updateSettings({ defaultReminderMinutes: Number(e.target.value) || 30 })}
          inputProps={{ min: 0, step: 5 }}
        />

        <FormControl fullWidth size="small">
          <InputLabel>{t('settings.completedTasks')}</InputLabel>
          <Select
            label={t('settings.completedTasks')}
            value={settings.completedTasksBehavior}
            onChange={(e) =>
              updateSettings({ completedTasksBehavior: e.target.value as UserSettings['completedTasksBehavior'] })
            }
          >
            <MenuItem value="keep">{t('settings.completedKeep')}</MenuItem>
            <MenuItem value="hide">{t('settings.completedHide')}</MenuItem>
          </Select>
        </FormControl>
      </SectionAccordion>

      <SectionAccordion icon={<Repeat color="primary" />} title={t('settings.habits')}>
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>{t('settings.dayStart')}</InputLabel>
          <Select
            label={t('settings.dayStart')}
            value={settings.dayStartHour}
            onChange={(e) => updateSettings({ dayStartHour: Number(e.target.value) })}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <MenuItem key={h} value={h}>{String(h).padStart(2, '0')}:00</MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          type="time"
          label={t('settings.habitsReminder')}
          size="small"
          fullWidth
          sx={{ mb: 2 }}
          value={settings.habitsReminderTime}
          onChange={(e) => updateSettings({ habitsReminderTime: e.target.value })}
          InputLabelProps={{ shrink: true }}
        />

        <SettingSwitch
          label={t('settings.skipWeekends')}
          description={t('settings.skipWeekendsHint')}
          checked={settings.habitsSkipWeekends}
          onChange={(v) => updateSettings({ habitsSkipWeekends: v })}
        />
        <SettingSwitch
          label={t('settings.hideCompletedHabits')}
          checked={settings.habitsAutoHideCompleted}
          onChange={(v) => updateSettings({ habitsAutoHideCompleted: v })}
        />
      </SectionAccordion>

      <SectionAccordion icon={<Telegram color="primary" />} title={t('settings.telegram')}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {tgStatus?.linked
            ? t('settings.telegramLinked', { chat: tgStatus.chat_id_masked || '****' })
            : t('settings.telegramNotLinked')}
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Button
            size="small"
            variant="contained"
            disabled={tgBusy}
            onClick={() => void handleTelegramLink()}
          >
            {t('settings.telegramLink')}
          </Button>
          <Button
            size="small"
            variant="outlined"
            disabled={tgBusy}
            onClick={() => void loadTelegram()}
          >
            {t('settings.telegramRefresh')}
          </Button>
          {tgStatus?.linked ? (
            <Button
              size="small"
              color="error"
              variant="outlined"
              disabled={tgBusy}
              onClick={() => void handleTelegramUnlink()}
            >
              {t('settings.telegramUnlink')}
            </Button>
          ) : null}
        </Box>

        {tgDeepLink ? (
          <Box sx={{ mb: 2 }}>
            <Alert severity="info" sx={{ mb: 1 }}>
              {t('settings.telegramLinkCreated')}
            </Alert>
            {tgLinkToken ? (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                {t('settings.telegramLinkHint', { token: tgLinkToken })}
              </Typography>
            ) : null}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                component="a"
                href={tgDeepLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('settings.telegramOpenLink')}
              </Button>
              <Button size="small" variant="text" onClick={() => void copyText(tgDeepLink)}>
                {t('settings.telegramCopyLink')}
              </Button>
              {tgLinkToken ? (
                <Button
                  size="small"
                  variant="text"
                  onClick={() => void copyText(`/start ${tgLinkToken}`)}
                >
                  {t('settings.telegramCopyStart')}
                </Button>
              ) : null}
            </Box>
          </Box>
        ) : null}

        {tgStatus?.linked ? (
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>{t('settings.telegramDefaultAccount')}</InputLabel>
            <Select
              label={t('settings.telegramDefaultAccount')}
              value={tgStatus.default_account_id ?? ''}
              disabled={tgBusy}
              onChange={(e) => {
                const v = e.target.value;
                void handleDefaultAccount(v === '' ? '' : Number(v));
              }}
            >
              <MenuItem value="">{t('settings.telegramNoAccount')}</MenuItem>
              {tgAccounts.map((acc) => (
                <MenuItem key={acc.id} value={acc.id}>
                  {acc.name} ({acc.currency})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : null}

        <Divider sx={{ my: 2 }} />
        <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
          {t('settings.telegramShortcuts')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t('settings.telegramShortcutsHelp')}
        </Typography>
        <Typography
          variant="body2"
          sx={{ mb: 1.5, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}
        >
          {t('settings.telegramShortcutsExamples')}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => void copyText('/expense 350 RUB @Cash Еда кофе')}
          >
            {t('settings.telegramCopyExpenseExample')}
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => void copyText('/income 50000 RUB счет:Зарплатная Зарплата')}
          >
            {t('settings.telegramCopyIncomeExample')}
          </Button>
          {tgStatus?.bot_url ? (
            <Button
              size="small"
              variant="text"
              component="a"
              href={tgStatus.bot_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('settings.telegramOpenBot')}
            </Button>
          ) : null}
        </Box>
      </SectionAccordion>

      <SectionAccordion icon={<Notifications color="primary" />} title={t('settings.notifications')}>
        <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>{t('settings.finance')}</Typography>
        <FormGroup sx={{ mb: 2 }}>
          <SettingSwitch label={t('settings.push')} checked={settings.notifyFinance.push} onChange={(v) => patchNotify('notifyFinance', { push: v })} />
          <SettingSwitch label={t('settings.emailNotify')} checked={settings.notifyFinance.email} onChange={(v) => patchNotify('notifyFinance', { email: v })} />
          <SettingSwitch label={t('settings.budgetExceeded')} checked={settings.notifyFinance.budgetExceeded} onChange={(v) => patchNotify('notifyFinance', { budgetExceeded: v })} />
        </FormGroup>

        <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>{t('settings.tasks')}</Typography>
        <FormGroup sx={{ mb: 2 }}>
          <SettingSwitch label={t('settings.push')} checked={settings.notifyTasks.push} onChange={(v) => patchNotify('notifyTasks', { push: v })} />
          <SettingSwitch label={t('settings.emailNotify')} checked={settings.notifyTasks.email} onChange={(v) => patchNotify('notifyTasks', { email: v })} />
          <SettingSwitch label={t('settings.deadline')} checked={settings.notifyTasks.deadline} onChange={(v) => patchNotify('notifyTasks', { deadline: v })} />
        </FormGroup>

        <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>{t('settings.habits')}</Typography>
        <FormGroup sx={{ mb: 2 }}>
          <SettingSwitch label={t('settings.push')} checked={settings.notifyHabits.push} onChange={(v) => patchNotify('notifyHabits', { push: v })} />
          <SettingSwitch label={t('settings.emailNotify')} checked={settings.notifyHabits.email} onChange={(v) => patchNotify('notifyHabits', { email: v })} />
          <SettingSwitch label={t('settings.dailyPush')} checked={settings.notifyHabits.daily} onChange={(v) => patchNotify('notifyHabits', { daily: v })} />
        </FormGroup>

        <Divider sx={{ my: 2 }} />
        <SettingSwitch
          label={t('settings.quietHours')}
          description={t('settings.quietHoursHint')}
          checked={settings.quietHoursEnabled}
          onChange={(v) => updateSettings({ quietHoursEnabled: v })}
        />
        {settings.quietHoursEnabled && (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField
              type="time"
              label={t('settings.quietFrom')}
              size="small"
              value={settings.quietHoursStart}
              onChange={(e) => updateSettings({ quietHoursStart: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              type="time"
              label={t('settings.quietTo')}
              size="small"
              value={settings.quietHoursEnd}
              onChange={(e) => updateSettings({ quietHoursEnd: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        )}
      </SectionAccordion>

      <SectionAccordion icon={<Palette color="primary" />} title={t('settings.interface')}>
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>{t('settings.theme')}</InputLabel>
          <Select
            label={t('settings.theme')}
            value={settings.theme}
            onChange={(e) => updateSettings({ theme: e.target.value as UserSettings['theme'] })}
          >
            <MenuItem value="dark">{t('settings.themeDark')}</MenuItem>
            <MenuItem value="light">{t('settings.themeLight')}</MenuItem>
            <MenuItem value="system">{t('settings.themeSystem')}</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>{t('settings.language')}</InputLabel>
          <Select
            label={t('settings.language')}
            value={settings.language}
            onChange={(e) => updateSettings({ language: e.target.value as UserSettings['language'] })}
          >
            <MenuItem value="ru">{t('settings.langRu')}</MenuItem>
            <MenuItem value="en">{t('settings.langEn')}</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>{t('settings.startScreen')}</InputLabel>
          <Select
            label={t('settings.startScreen')}
            value={settings.startScreen}
            onChange={(e) => updateSettings({ startScreen: e.target.value as UserSettings['startScreen'] })}
          >
            {START_SCREENS.map((screen) => (
              <MenuItem key={screen} value={screen}>{startScreenLabel(settings.language, screen)}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Divider sx={{ my: 2 }} />
        <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
          {t('settings.export')}
        </Typography>
        <Box sx={{ mb: 2 }}>
          <ExportModuleRow
            label={t('settings.exportAll')}
            disabled={exporting}
            csvLabel={t('settings.exportCsv')}
            excelLabel={t('settings.exportExcel')}
            onExport={(format) => handleExport('all', format)}
          />
          <ExportModuleRow
            label={t('settings.exportFinance')}
            disabled={exporting}
            csvLabel={t('settings.exportCsv')}
            excelLabel={t('settings.exportExcel')}
            onExport={(format) => handleExport('finance', format)}
          />
          <ExportModuleRow
            label={t('settings.exportTasks')}
            disabled={exporting}
            csvLabel={t('settings.exportCsv')}
            excelLabel={t('settings.exportExcel')}
            onExport={(format) => handleExport('tasks', format)}
          />
          <ExportModuleRow
            label={t('settings.exportHabits')}
            disabled={exporting}
            csvLabel={t('settings.exportCsv')}
            excelLabel={t('settings.exportExcel')}
            onExport={(format) => handleExport('habits', format)}
          />
        </Box>

        <Divider sx={{ my: 2 }} />
        <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
          {t('settings.security')}
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('settings.localStorageHint')}
        </Alert>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          <Button variant="outlined" onClick={() => { resetSettings(); showInfo(t('settings.resetSuccess')); }}>
            {t('settings.reset')}
          </Button>
          <Button variant="outlined" color="warning" onClick={() => setDeleteDialogOpen(true)}>
            {t('settings.deleteLocal')}
          </Button>
          <Button variant="outlined" color="error" startIcon={<Logout />} onClick={handleLogout}>
            {t('settings.logout')}
          </Button>
        </Box>
      </SectionAccordion>

      <Dialog open={currencyDialogOpen} onClose={cancelCurrencyChange}>
        <DialogTitle>{t('settings.currencyDialogTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('settings.currencyDialogText', { currency: pendingCurrency || '' })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelCurrencyChange}>{t('settings.cancel')}</Button>
          <Button variant="contained" onClick={confirmCurrencyChange}>{t('settings.confirm')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('settings.deleteDialogTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('settings.deleteDialogText')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('settings.cancel')}</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              localStorage.clear();
              setDeleteDialogOpen(false);
              handleLogout();
            }}
          >
            {t('settings.deleteAndLogout')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
