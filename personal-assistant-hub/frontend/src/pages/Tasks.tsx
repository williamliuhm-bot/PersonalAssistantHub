import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  CircularProgress,
  FormControl,
  InputLabel,
} from '@mui/material';
import { Add, Search, DragIndicator } from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import { tasksApi, type Task } from '../api/tasks';
import { useSettings } from '../store/settingsStore';

const COLUMNS = [
  { id: 'todo', title: 'TODO', color: '#F59E0B' },
  { id: 'in_progress', title: 'IN PROGRESS', color: '#2563EB' },
  { id: 'done', title: 'DONE', color: '#10B981' },
];

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high: '#F59E0B',
  medium: '#2563EB',
  low: '#94A3B8',
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Критичный',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

const columnVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.05 } },
};

export default function Tasks() {
  const { settings } = useSettings();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [addDialog, setAddDialog] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium' as Task['priority'], deadline: '' });
  const [editDialog, setEditDialog] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const fetchTasks = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (searchQuery) params.search = searchQuery;
    if (priorityFilter) params.priority = priorityFilter;
    tasksApi.getTasks(params).then((r) => {
      setTasks(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [searchQuery, priorityFilter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId as Task['status'];
    setTasks((prev) =>
      prev.map((t) => (t.id.toString() === taskId ? { ...t, status: newStatus } : t))
    );
    tasksApi.updateTask(Number(taskId), { status: newStatus }).catch(() => fetchTasks());
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;
    try {
      await tasksApi.createTask({
        title: newTask.title,
        description: newTask.description,
        priority: newTask.priority,
        deadline: newTask.deadline || undefined,
      });
      setAddDialog(false);
      setNewTask({ title: '', description: '', priority: 'medium', deadline: '' });
      fetchTasks();
    } catch {}
  };

  const handleEditClick = (task: Task) => {
    setEditTask(task);
    setEditDialog(true);
  };

  const handleEditSave = async () => {
    if (!editTask || !editTask.title.trim()) return;
    try {
      await tasksApi.updateTask(editTask.id, {
        title: editTask.title,
        description: editTask.description,
        priority: editTask.priority,
        status: editTask.status,
        deadline: editTask.deadline || undefined,
      });
      setEditDialog(false);
      setEditTask(null);
      fetchTasks();
    } catch {}
  };

  const handleDeleteTask = async (id: number) => {
    try {
      await tasksApi.deleteTask(id);
      fetchTasks();
    } catch {}
  };

  const visibleColumns = settings.completedTasksBehavior === 'hide'
    ? COLUMNS.filter((c) => c.id !== 'done')
    : COLUMNS;

  const getColumnTasks = (status: string) =>
    tasks.filter((t) => t.status === status);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>Задачи</Typography>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Поиск задач..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ minWidth: 220 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>,
            }}
          />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Приоритет</InputLabel>
            <Select
              value={priorityFilter}
              label="Приоритет"
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <MenuItem value="">Все</MenuItem>
              <MenuItem value="critical">Критичный</MenuItem>
              <MenuItem value="high">Высокий</MenuItem>
              <MenuItem value="medium">Средний</MenuItem>
              <MenuItem value="low">Низкий</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={<Add />} onClick={() => setAddDialog(true)}>
            Добавить
          </Button>
        </Box>
      </Box>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            gap: 2,
            minHeight: '60vh',
          }}
        >
          {visibleColumns.map((col) => (
            <motion.div key={col.id} variants={columnVariants} initial="hidden" animate="visible">
              <Card
                sx={{
                  bgcolor: 'rgba(30, 41, 59, 0.6)',
                  border: '1px solid rgba(148, 163, 184, 0.08)',
                  minHeight: 400,
                }}
              >
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: col.color }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {col.title}
                    </Typography>
                    <Chip label={getColumnTasks(col.id).length} size="small" sx={{ ml: 'auto', fontWeight: 600 }} />
                  </Box>

                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <Box
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        sx={{
                          minHeight: 300,
                          transition: 'background 0.2s',
                          bgcolor: snapshot.isDraggingOver ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
                          borderRadius: 2,
                          p: 0.5,
                        }}
                      >
                        {getColumnTasks(col.id).map((task, idx) => (
                          <Draggable key={task.id} draggableId={task.id.toString()} index={idx}>
                            {(provided, snapshot) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                onClick={() => handleEditClick(task)}
                                sx={{
                                  mb: 1,
                                  bgcolor: 'background.paper',
                                  border: '1px solid rgba(148, 163, 184, 0.1)',
                                  opacity: snapshot.isDragging ? 0.85 : 1,
                                  cursor: 'pointer',
                                  '&:hover': { borderColor: 'rgba(148, 163, 184, 0.25)' },
                                }}
                              >
                                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                  <Box {...provided.dragHandleProps} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 0.5 }}>
                                    <DragIndicator sx={{ fontSize: 16, color: 'text.secondary', mt: 0.3, cursor: 'grab' }} />
                                    <Box sx={{ flex: 1 }}>
                                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                        {task.title}
                                      </Typography>
                                    </Box>
                                    <IconButton
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteTask(task.id);
                                      }}
                                      sx={{ p: 0.3 }}
                                    >
                                      <Typography variant="caption" color="error.main">✕</Typography>
                                    </IconButton>
                                  </Box>
                                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', ml: 3 }}>
                                    <Chip
                                      label={PRIORITY_LABELS[task.priority] || task.priority}
                                      size="small"
                                      sx={{
                                        height: 20,
                                        fontSize: 10,
                                        fontWeight: 600,
                                        bgcolor: `${PRIORITY_COLORS[task.priority]}20`,
                                        color: PRIORITY_COLORS[task.priority],
                                      }}
                                    />
                                    {task.deadline && (
                                      <Typography variant="caption" color="text.secondary">
                                        {dayjs(task.deadline).format('DD.MM')}
                                      </Typography>
                                    )}
                                  </Box>
                                </CardContent>
                              </Card>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {getColumnTasks(col.id).length === 0 && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', py: 4 }}>
                            Нет задач
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Droppable>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </Box>
      </DragDropContext>

      <Dialog open={addDialog} onClose={() => setAddDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Новая задача</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Название"
              fullWidth
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            />
            <TextField
              label="Описание"
              fullWidth
              multiline
              rows={3}
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>Приоритет</InputLabel>
              <Select
                value={newTask.priority}
                label="Приоритет"
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as Task['priority'] })}
              >
                <MenuItem value="low">Низкий</MenuItem>
                <MenuItem value="medium">Средний</MenuItem>
                <MenuItem value="high">Высокий</MenuItem>
                <MenuItem value="critical">Критичный</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Дедлайн"
              type="date"
              fullWidth
              value={newTask.deadline}
              onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialog(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleAddTask}>Создать</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Редактировать задачу</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Название"
              fullWidth
              value={editTask?.title || ''}
              onChange={(e) => setEditTask(editTask ? { ...editTask, title: e.target.value } : null)}
            />
            <TextField
              label="Описание"
              fullWidth
              multiline
              rows={3}
              value={editTask?.description || ''}
              onChange={(e) => setEditTask(editTask ? { ...editTask, description: e.target.value } : null)}
            />
            <FormControl fullWidth>
              <InputLabel>Приоритет</InputLabel>
              <Select
                value={editTask?.priority || 'medium'}
                label="Приоритет"
                onChange={(e) => setEditTask(editTask ? { ...editTask, priority: e.target.value as Task['priority'] } : null)}
              >
                <MenuItem value="low">Низкий</MenuItem>
                <MenuItem value="medium">Средний</MenuItem>
                <MenuItem value="high">Высокий</MenuItem>
                <MenuItem value="critical">Критичный</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Статус</InputLabel>
              <Select
                value={editTask?.status || 'todo'}
                label="Статус"
                onChange={(e) => setEditTask(editTask ? { ...editTask, status: e.target.value as Task['status'] } : null)}
              >
                <MenuItem value="todo">TODO</MenuItem>
                <MenuItem value="in_progress">IN PROGRESS</MenuItem>
                <MenuItem value="done">DONE</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Дедлайн"
              type="date"
              fullWidth
              value={editTask?.deadline?.slice(0, 10) || ''}
              onChange={(e) => setEditTask(editTask ? { ...editTask, deadline: e.target.value } : null)}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleEditSave}>Сохранить</Button>
        </DialogActions>
      </Dialog>
    </motion.div>
  );
}
