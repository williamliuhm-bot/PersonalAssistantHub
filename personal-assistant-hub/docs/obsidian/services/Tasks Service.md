---
tags:
  - pah
  - service
---

# Tasks Service

**Порт:** 8003 · папка `tasks-service/`

![[assets/ui-tasks.png]]

## Сущности

```python
# tasks-service/app/models.py
class Project(Base): ...
class Task(Base):
    status = Column(Enum("TODO", "IN_PROGRESS", "DONE", ...))
    priority = Column(Enum("LOW", "MEDIUM", "HIGH", "CRITICAL", ...))
class Habit(Base): ...
class HabitLog(Base): ...
```

## Клиент
`/tasks`, `/habits`, `/calendar`.  
Модули: [[Задачи и проекты]], [[Привычки]], [[Календарь]].

## См. также

[[Доменная модель]] · [[Integration Service]]
