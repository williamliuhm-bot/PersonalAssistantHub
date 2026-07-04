import { Box, IconButton, Typography } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/ru';

dayjs.locale('ru');

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

interface HabitMonthCalendarProps {
  month: Dayjs;
  onMonthChange: (next: Dayjs) => void;
  completedDates: Set<string>;
  accentColor?: string;
}

export default function HabitMonthCalendar({
  month,
  onMonthChange,
  completedDates,
  accentColor = '#2563EB',
}: HabitMonthCalendarProps) {
  const start = month.startOf('month');
  const daysInMonth = month.daysInMonth();
  const firstWeekday = (start.day() + 6) % 7; // Monday = 0
  const today = dayjs().format('YYYY-MM-DD');

  const cells: Array<{ key: string; day: number | null }> = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ key: `empty-${i}`, day: null });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ key: `day-${day}`, day });
  }

  return (
    <Box sx={{ containerType: 'inline-size', width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 'clamp(12px, 3cqw, 16px)' }}>
        <IconButton size="small" onClick={() => onMonthChange(month.subtract(1, 'month'))} aria-label="Предыдущий месяц">
          <ChevronLeft sx={{ fontSize: 'clamp(18px, 5cqw, 24px)' }} />
        </IconButton>
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 600,
            textTransform: 'capitalize',
            fontSize: 'clamp(0.85rem, 3.5cqw, 1rem)',
            whiteSpace: 'nowrap',
          }}
        >
          {month.format('MMMM YYYY')}
        </Typography>
        <IconButton size="small" onClick={() => onMonthChange(month.add(1, 'month'))} aria-label="Следующий месяц">
          <ChevronRight sx={{ fontSize: 'clamp(18px, 5cqw, 24px)' }} />
        </IconButton>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 'clamp(2px, 0.8cqw, 6px)',
        }}
      >
        {WEEKDAYS.map((label) => (
          <Typography
            key={label}
            variant="caption"
            color="text.secondary"
            sx={{
              textAlign: 'center',
              fontWeight: 600,
              py: '0.35em',
              fontSize: 'clamp(0.65rem, 2.8cqw, 0.75rem)',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </Typography>
        ))}

        {cells.map(({ key, day }) => {
          if (day === null) {
            return <Box key={key} sx={{ minHeight: 'clamp(28px, 8cqw, 40px)' }} />;
          }

          const dateStr = month.date(day).format('YYYY-MM-DD');
          const isCompleted = completedDates.has(dateStr);
          const isToday = dateStr === today;

          return (
            <Box
              key={key}
              sx={{
                minHeight: 'clamp(28px, 8cqw, 40px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 1,
                fontSize: 'clamp(0.65rem, 3cqw, 0.8rem)',
                fontWeight: isToday ? 700 : 500,
                whiteSpace: 'nowrap',
                color: isCompleted ? '#fff' : isToday ? 'primary.main' : 'text.primary',
                bgcolor: isCompleted ? accentColor : isToday ? 'rgba(37, 99, 235, 0.12)' : 'transparent',
                border: isToday && !isCompleted ? '1px solid' : 'none',
                borderColor: 'primary.main',
              }}
            >
              {day}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
