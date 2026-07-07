import { useState, useEffect, useMemo, type ReactNode } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
  CircularProgress,
  Chip,
  IconButton,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add,
  Whatshot,
  CheckCircleOutline,
  RadioButtonUnchecked,
  EditOutlined,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { tasksApi, type Habit } from '../api/tasks';
import HabitMonthCalendar from '../components/HabitMonthCalendar';

const HABIT_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

function normalizeFrequency(frequency?: string): Habit['frequency'] {
  const value = (frequency || 'daily').toLowerCase();
  if (value === 'weekly' || value === 'monthly') return value;
  return 'daily';
}

function getProgress(frequency: string, streak: number): number {
  const freq = normalizeFrequency(frequency);
  if (freq === 'weekly') return Math.min(streak / 12, 1);
  if (freq === 'monthly') return Math.min(streak / 6, 1);
  return Math.min(streak / 30, 1);
}

function getTimesPerDayLabel(timesPerDay: number): string {
  if (timesPerDay === 1) return '1 раз в день';
  return `${timesPerDay} раза в день`;
}

function isHabitCompletedToday(habit: Habit): boolean {
  const target = habit.times_per_day || 1;
  const done = habit.today_count ?? 0;
  return done >= target;
}

function getCompleteButtonLabel(habit: Habit): string {
  const target = habit.times_per_day || 1;
  const done = habit.today_count ?? 0;
  if (done >= target) return 'Выполнено';
  if (target === 1) return 'Отметить';
  return `Отметить (${done}/${target})`;
}

function TabPanel({ value, index, children }: { value: number; index: number; children: ReactNode }) {
  if (value !== index) return null;
  return <Box sx={{ pt: 2 }}>{children}</Box>;
}

export default function Habits() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [addDialog, setAddDialog] = useState(false);
  const [newHabit, setNewHabit] = useState({
    title: '',
    description: '',
    frequency: 'daily' as Habit['frequency'],
    times_per_day: 1,
    color: HABIT_COLORS[0],
  });
  const [editDialog, setEditDialog] = useState(false);
  const [editHabit, setEditHabit] = useState<Habit | null>(null);
  const [calendarHabitId, setCalendarHabitId] = useState<number | ''>('');
  const [calendarMonth, setCalendarMonth] = useState(dayjs());
  const [calendarDates, setCalendarDates] = useState<Set<string>>(new Set());
  const [calendarLoading, setCalendarLoading] = useState(false);

  const fetchHabits = () => {
    setLoading(true);
    tasksApi.getHabits()
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : [];
        setHabits(list);
        if (list.length > 0 && calendarHabitId === '') {
          setCalendarHabitId(list[0].id);
        }
      })
      .catch(() => setHabits([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchHabits(); }, []);

  useEffect(() => {
    if (tab !== 1 || calendarHabitId === '') return;

    setCalendarLoading(true);
    tasksApi
      .getHabitCalendar(calendarHabitId, calendarMonth.year(), calendarMonth.month() + 1)
      .then((r) => {
        const completed = new Set(
          (r.data.days || []).filter((d) => d.completed).map((d) => d.date.slice(0, 10)),
        );
        setCalendarDates(completed);
      })
      .catch(() => setCalendarDates(new Set()))
      .finally(() => setCalendarLoading(false));
  }, [tab, calendarHabitId, calendarMonth]);

  const selectedCalendarHabit = useMemo(
    () => habits.find((h) => h.id === calendarHabitId) || null,
    [habits, calendarHabitId],
  );

  const handleComplete = async (id: number) => {
    try {
      await tasksApi.completeHabit(id);
      fetchHabits();
    } catch {}
  };

  const handleAdd = async () => {
    if (!newHabit.title.trim()) return;
    try {
      await tasksApi.createHabit(newHabit);
      setAddDialog(false);
      setNewHabit({ title: '', description: '', frequency: 'daily', times_per_day: 1, color: HABIT_COLORS[0] });
      fetchHabits();
    } catch {}
  };

  const handleEditClick = (habit: Habit) => {
    setEditHabit({
      ...habit,
      frequency: normalizeFrequency(habit.frequency),
      times_per_day: habit.times_per_day || 1,
      today_count: habit.today_count ?? 0,
    });
    setEditDialog(true);
  };

  const handleEditSave = async () => {
    if (!editHabit || !editHabit.title.trim()) return;
    try {
      await tasksApi.updateHabit(editHabit.id, {
        title: editHabit.title,
        description: editHabit.description,
        frequency: editHabit.frequency,
        times_per_day: editHabit.times_per_day,
        color: editHabit.color,
      });
      setEditDialog(false);
      setEditHabit(null);
      fetchHabits();
    } catch {}
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 2,
          mb: 2,
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Привычки
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setAddDialog(true)} sx={{ alignSelf: { xs: 'stretch', sm: 'auto' } }}>
          Добавить
        </Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Список" />
        <Tab label="Календарь" />
      </Tabs>

      <TabPanel value={tab} index={0}>
        {habits.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 8 }}>
            Нет привычек. Начните добавлять!
          </Typography>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
              gap: { xs: 2, md: 2.5 },
              width: '100%',
            }}
          >
            {habits.map((habit, idx) => {
              const color = habit.color || HABIT_COLORS[idx % HABIT_COLORS.length];
              const isCompletedToday = isHabitCompletedToday(habit);
              const progress = getProgress(habit.frequency, habit.streak);
              const timesPerDay = habit.times_per_day || 1;

              return (
                <Card
                  key={habit.id}
                  sx={{
                    containerType: 'inline-size',
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    minHeight: 'clamp(170px, 55cqw, 220px)',
                    position: 'relative',
                    overflow: 'hidden',
                    fontSize: 'clamp(0.72rem, 2.8cqw + 0.35rem, 0.875rem)',
                    border: isCompletedToday
                      ? '1px solid rgba(16, 185, 129, 0.3)'
                      : '1px solid rgba(148, 163, 184, 0.12)',
                  }}
                >
                  <Box sx={{ position: 'absolute', top: 0, left: 0, width: 'clamp(3px, 1cqw, 4px)', height: '100%', bgcolor: color }} />
                  <CardContent
                    sx={{
                      pl: 'clamp(14px, 4.5cqw, 20px)',
                      pr: 'clamp(12px, 3.5cqw, 16px)',
                      pt: 'clamp(12px, 4cqw, 16px)',
                      pb: 'clamp(12px, 4cqw, 16px)',
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      '&:last-child': { pb: 'clamp(12px, 4cqw, 16px)' },
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        flexWrap: 'nowrap',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '0.75em',
                        mb: '1.25em',
                        minWidth: 0,
                      }}
                    >
                      <Box sx={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}>
                        <Typography
                          component="div"
                          sx={{
                            fontWeight: 600,
                            fontSize: '1.05em',
                            lineHeight: 1.35,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            wordBreak: 'normal',
                            overflowWrap: 'normal',
                          }}
                        >
                          {habit.title}
                        </Typography>
                        {habit.description ? (
                          <Typography
                            component="div"
                            color="text.secondary"
                            sx={{
                              mt: '0.25em',
                              fontSize: '0.85em',
                              lineHeight: 1.35,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              wordBreak: 'normal',
                              overflowWrap: 'normal',
                            }}
                          >
                            {habit.description}
                          </Typography>
                        ) : null}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.35em', flexShrink: 0 }}>
                        <Chip
                          label={getTimesPerDayLabel(timesPerDay)}
                          size="small"
                          variant="outlined"
                          sx={{
                            fontSize: '0.75em',
                            height: 'auto',
                            py: '0.15em',
                            '& .MuiChip-label': { px: '0.6em', whiteSpace: 'nowrap' },
                          }}
                        />
                        <IconButton size="small" onClick={() => handleEditClick(habit)} aria-label="Редактировать" sx={{ p: '0.35em' }}>
                          <EditOutlined sx={{ fontSize: '1.15em' }} />
                        </IconButton>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5em', mb: '1.25em', flexWrap: 'nowrap', minWidth: 0 }}>
                      <Whatshot sx={{ color: 'warning.main', fontSize: '1.35em', flexShrink: 0 }} />
                      <Typography
                        sx={{
                          fontWeight: 700,
                          color: 'warning.main',
                          lineHeight: 1,
                          fontSize: '1.65em',
                          flexShrink: 0,
                        }}
                      >
                        {habit.streak}
                      </Typography>
                      <Typography
                        color="text.secondary"
                        sx={{ fontSize: '0.85em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        дней подряд
                      </Typography>
                    </Box>

                    <LinearProgress
                      variant="determinate"
                      value={progress * 100}
                      sx={{
                        height: '0.45em',
                        borderRadius: 3,
                        bgcolor: 'rgba(148, 163, 184, 0.12)',
                        mb: '1.25em',
                        '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
                      }}
                    />

                    <Box sx={{ mt: 'auto' }}>
                      <Button
                        fullWidth
                        variant={isCompletedToday ? 'outlined' : 'contained'}
                        color={isCompletedToday ? 'success' : 'primary'}
                        size="small"
                        startIcon={isCompletedToday ? <CheckCircleOutline sx={{ fontSize: '1.1em !important' }} /> : <RadioButtonUnchecked sx={{ fontSize: '1.1em !important' }} />}
                        onClick={() => handleComplete(habit.id)}
                        disabled={isCompletedToday}
                        sx={{
                          fontSize: '0.9em',
                          py: '0.55em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {getCompleteButtonLabel(habit)}
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        )}
      </TabPanel>

      <TabPanel value={tab} index={1}>
        {habits.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 8 }}>
            Нет привычек для календаря
          </Typography>
        ) : (
          <Card sx={{ maxWidth: 560, mx: 'auto' }}>
            <CardContent>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Привычка</InputLabel>
                <Select
                  value={calendarHabitId}
                  label="Привычка"
                  onChange={(e) => setCalendarHabitId(Number(e.target.value))}
                >
                  {habits.map((habit) => (
                    <MenuItem key={habit.id} value={habit.id}>{habit.title}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {calendarLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : (
                <HabitMonthCalendar
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  completedDates={calendarDates}
                  accentColor={selectedCalendarHabit?.color || HABIT_COLORS[0]}
                />
              )}
            </CardContent>
          </Card>
        )}
      </TabPanel>

      <Dialog open={addDialog} onClose={() => setAddDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Новая привычка</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Название" fullWidth value={newHabit.title} onChange={(e) => setNewHabit({ ...newHabit, title: e.target.value })} />
            <TextField label="Описание" fullWidth multiline rows={2} value={newHabit.description} onChange={(e) => setNewHabit({ ...newHabit, description: e.target.value })} />
            <TextField
              label="Раз в день"
              type="number"
              fullWidth
              inputProps={{ min: 1, max: 20 }}
              value={newHabit.times_per_day}
              onChange={(e) => setNewHabit({
                ...newHabit,
                times_per_day: Math.min(20, Math.max(1, Number(e.target.value) || 1)),
              })}
              helperText="Сколько раз нужно выполнить привычку за день"
            />
            <FormControl fullWidth>
              <InputLabel>Частота</InputLabel>
              <Select value={newHabit.frequency} label="Частота" onChange={(e) => setNewHabit({ ...newHabit, frequency: e.target.value as Habit['frequency'] })}>
                <MenuItem value="daily">Ежедневно</MenuItem>
                <MenuItem value="weekly">Еженедельно</MenuItem>
                <MenuItem value="monthly">Ежемесячно</MenuItem>
              </Select>
            </FormControl>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Цвет</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {HABIT_COLORS.map((color) => (
                  <Box
                    key={color}
                    onClick={() => setNewHabit({ ...newHabit, color })}
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      bgcolor: color,
                      cursor: 'pointer',
                      border: newHabit.color === color ? '3px solid #fff' : '3px solid transparent',
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialog(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleAdd}>Создать</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Редактировать привычку</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Название" fullWidth value={editHabit?.title || ''} onChange={(e) => setEditHabit(editHabit ? { ...editHabit, title: e.target.value } : null)} />
            <TextField label="Описание" fullWidth multiline rows={2} value={editHabit?.description || ''} onChange={(e) => setEditHabit(editHabit ? { ...editHabit, description: e.target.value } : null)} />
            <TextField
              label="Раз в день"
              type="number"
              fullWidth
              inputProps={{ min: 1, max: 20 }}
              value={editHabit?.times_per_day ?? 1}
              onChange={(e) => setEditHabit(editHabit ? {
                ...editHabit,
                times_per_day: Math.min(20, Math.max(1, Number(e.target.value) || 1)),
              } : null)}
            />
            <FormControl fullWidth>
              <InputLabel>Частота</InputLabel>
              <Select
                value={editHabit?.frequency || 'daily'}
                label="Частота"
                onChange={(e) => setEditHabit(editHabit ? { ...editHabit, frequency: e.target.value as Habit['frequency'] } : null)}
              >
                <MenuItem value="daily">Ежедневно</MenuItem>
                <MenuItem value="weekly">Еженедельно</MenuItem>
                <MenuItem value="monthly">Ежемесячно</MenuItem>
              </Select>
            </FormControl>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Цвет</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {HABIT_COLORS.map((color) => (
                  <Box
                    key={color}
                    onClick={() => setEditHabit(editHabit ? { ...editHabit, color } : null)}
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      bgcolor: color,
                      cursor: 'pointer',
                      border: editHabit?.color === color ? '3px solid #fff' : '3px solid transparent',
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleEditSave}>Сохранить</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
