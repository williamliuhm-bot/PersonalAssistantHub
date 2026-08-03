import client from './client';

export interface Project {
  id: number;
  name: string;
  color: string;
  description?: string;
  created_at?: string;
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  project_id?: number | null;
  project_name?: string;
  project_color?: string;
  deadline?: string;
  created_at: string;
  completed_at?: string;
}

export interface Habit {
  id: number;
  title: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  times_per_day: number;
  today_count: number;
  streak: number;
  color: string;
  icon?: string;
  last_completed?: string | null;
  created_at: string;
}

export interface HabitCalendarDay {
  date: string;
  completed: boolean;
  count?: number;
  target?: number;
}

export interface HabitCalendar {
  habit_id: number;
  year: number;
  month: number;
  days: HabitCalendarDay[];
}

export const tasksApi = {
  getProjects: () =>
    client.get<Project[]>('/tasks/api/projects'),

  createProject: (data: { name: string; description?: string; color?: string }) =>
    client.post<Project>('/tasks/api/projects', data),

  updateProject: (id: number, data: { name?: string; description?: string; color?: string }) =>
    client.patch<Project>(`/tasks/api/projects/${id}`, data),

  deleteProject: (id: number) =>
    client.delete(`/tasks/api/projects/${id}`),

  getTasks: (params?: { status?: string; priority?: string; project_id?: number; search?: string }) =>
    client.get<Task[]>('/tasks/api/tasks', { params }),

  createTask: (data: {
    title: string;
    description?: string;
    priority?: string;
    status?: string;
    project_id?: number | null;
    deadline?: string;
  }) =>
    client.post<Task>('/tasks/api/tasks', data),

  updateTask: (id: number, data: {
    title?: string;
    description?: string;
    priority?: string;
    status?: string;
    project_id?: number | null;
    deadline?: string;
  }) =>
    client.patch<Task>(`/tasks/api/tasks/${id}`, data),

  deleteTask: (id: number) =>
    client.delete(`/tasks/api/tasks/${id}`),

  getHabits: () =>
    client.get<Habit[]>('/tasks/api/habits'),

  createHabit: (data: Partial<Habit>) =>
    client.post<Habit>('/tasks/api/habits', data),

  updateHabit: (id: number, data: Partial<Habit>) =>
    client.patch<Habit>(`/tasks/api/habits/${id}`, data),

  deleteHabit: (id: number) =>
    client.delete(`/tasks/api/habits/${id}`),

  completeHabit: (id: number) =>
    client.post(`/tasks/api/habits/${id}/log`),

  getHabitCalendar: (id: number, year?: number, month?: number) =>
    client.get<HabitCalendar>(`/tasks/api/habits/${id}/calendar`, {
      params: { year, month },
    }),
};
