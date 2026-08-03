import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
} from '@mui/material';
import { Add, DeleteOutline, EditOutlined } from '@mui/icons-material';
import { tasksApi, type Project } from '../api/tasks';
import { useSettings } from '../store/settingsStore';
import { useTranslation } from '../i18n/useTranslation';
import type { SelectedProjectId } from '../types/settings';

const PRESET_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];

interface ProjectSwitcherProps {
  onProjectsChange?: (projects: Project[]) => void;
}

export default function ProjectSwitcher({ onProjectsChange }: ProjectSwitcherProps) {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const selected = settings.selectedProjectId;

  const [projects, setProjects] = useState<Project[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const res = await tasksApi.getProjects();
      const list = Array.isArray(res.data) ? res.data : [];
      setProjects(list);
      onProjectsChange?.(list);
    } catch {
      setProjects([]);
      onProjectsChange?.([]);
    }
  }, [onProjectsChange]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (selected !== 'all' && projects.length > 0 && !projects.some((p) => p.id === selected)) {
      updateSettings({ selectedProjectId: 'all' });
    }
  }, [selected, projects, updateSettings]);

  const selectProject = (id: SelectedProjectId) => {
    updateSettings({ selectedProjectId: id });
  };

  const openCreate = () => {
    setEditing(null);
    setName('');
    setColor(PRESET_COLORS[projects.length % PRESET_COLORS.length]);
    setDialogOpen(true);
  };

  const openEdit = (project: Project) => {
    setEditing(project);
    setName(project.name);
    setColor(project.color || PRESET_COLORS[0]);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await tasksApi.updateProject(editing.id, { name: name.trim(), color });
      } else {
        const created = await tasksApi.createProject({ name: name.trim(), color });
        updateSettings({ selectedProjectId: created.data.id });
      }
      setDialogOpen(false);
      await loadProjects();
    } catch {
      // keep dialog open
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (project: Project) => {
    if (!window.confirm(t('projects.deleteConfirm', { name: project.name }))) return;
    try {
      await tasksApi.deleteProject(project.id);
      if (selected === project.id) {
        updateSettings({ selectedProjectId: 'all' });
      }
      await loadProjects();
    } catch {
      // ignore
    }
  };

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Chip
          label={t('projects.all')}
          clickable
          onClick={() => selectProject('all')}
          variant={selected === 'all' ? 'filled' : 'outlined'}
          color={selected === 'all' ? 'primary' : 'default'}
          size="small"
        />
        {projects.map((project) => {
          const active = selected === project.id;
          return (
            <Chip
              key={project.id}
              label={project.name}
              clickable
              onClick={() => selectProject(project.id)}
              onDelete={() => openEdit(project)}
              deleteIcon={
                <Tooltip title={t('projects.edit')}>
                  <EditOutlined sx={{ fontSize: 16 }} />
                </Tooltip>
              }
              variant={active ? 'filled' : 'outlined'}
              size="small"
              sx={{
                borderColor: project.color,
                ...(active
                  ? { bgcolor: project.color, color: '#fff', '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.85)' } }
                  : { color: project.color, '& .MuiChip-deleteIcon': { color: project.color } }),
              }}
            />
          );
        })}
        <Tooltip title={t('projects.create')}>
          <IconButton size="small" onClick={openCreate} aria-label={t('projects.create')}>
            <Add fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editing ? t('projects.edit') : t('projects.create')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label={t('projects.name')}
              fullWidth
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('projects.namePlaceholder')}
            />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {PRESET_COLORS.map((c) => (
                <Box
                  key={c}
                  onClick={() => setColor(c)}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    bgcolor: c,
                    cursor: 'pointer',
                    outline: color === c ? '2px solid' : 'none',
                    outlineColor: 'text.primary',
                    outlineOffset: 2,
                  }}
                />
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: editing ? 'space-between' : 'flex-end' }}>
          {editing && (
            <Button
              color="error"
              startIcon={<DeleteOutline />}
              onClick={() => {
                setDialogOpen(false);
                handleDelete(editing);
              }}
            >
              {t('projects.delete')}
            </Button>
          )}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => setDialogOpen(false)}>{t('projects.cancel')}</Button>
            <Button variant="contained" disabled={!name.trim() || saving} onClick={handleSave}>
              {t('projects.save')}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </>
  );
}
