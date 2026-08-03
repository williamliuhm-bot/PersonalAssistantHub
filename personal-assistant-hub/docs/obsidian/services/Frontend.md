---
tags:
  - pah
  - service
  - frontend
---

# Frontend

Папка `frontend/` · порты 5173 (Vite) / 3000 (nginx в Docker).

![[assets/ui-dashboard.png]]

## Стек
React 18 + TS + Vite + MUI + Electron + Framer Motion + Recharts.  
Подробнее: [[Стек технологий]].

## Маршруты (фрагмент)

```tsx
// frontend/src/App.tsx
<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/tg" element={<TelegramMiniApp />} />
  <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
    <Route index element={<HomeRedirect />} />
    <Route path="dashboard" element={<Dashboard />} />
    <Route path="finance" element={<Finance />} />
    <Route path="tasks" element={<Tasks />} />
    <Route path="calendar" element={<Calendar />} />
    <Route path="habits" element={<Habits />} />
    <Route path="analytics" element={<Analytics />} />
    <Route path="notifications" element={<Notifications />} />
    <Route path="settings" element={<Settings />} />
    <Route path="admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
  </Route>
</Routes>
```

| Path | Страница |
|------|----------|
| `/login` | Login |
| `/tg` | Telegram Mini App |
| `/dashboard` | Dashboard |
| `/finance` | Finance |
| `/tasks` | Tasks |
| `/calendar` | Calendar |
| `/habits` | Habits |
| `/analytics` | Analytics |
| `/notifications` | Notifications |
| `/settings` | Settings |
| `/admin/users` | AdminUsers |

Галерея: [[Скриншоты UI]].

## API-клиенты
`src/api/`: `client`, `auth`, `finance`, `tasks`, `analytics`, `notifications`, `telegram`, `telegramWebApp`.

## UI-компоненты
Layout, Sidebar, TopBar, SoftCard, PageHeader, ProjectSwitcher.

## См. также

[[Настройки]] · [[Telegram]] · [[Авторизация и админка]]
