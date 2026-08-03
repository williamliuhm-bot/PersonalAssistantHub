import datetime
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    color: Optional[str] = "#6366f1"


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    user_id: int
    name: str
    description: Optional[str] = ""
    color: Optional[str] = "#6366f1"
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

    model_config = {"from_attributes": True}


class TaskCreate(BaseModel):
    project_id: Optional[int] = None
    title: str
    description: Optional[str] = ""
    priority: Optional[str] = "MEDIUM"
    status: Optional[str] = "TODO"
    deadline: Optional[datetime.datetime] = None
    order_index: Optional[int] = 0


class TaskUpdate(BaseModel):
    project_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    deadline: Optional[datetime.datetime] = None
    order_index: Optional[int] = None


class TaskReorderItem(BaseModel):
    id: int
    order_index: int
    status: Optional[str] = None


class TaskReorderRequest(BaseModel):
    items: list[TaskReorderItem]


class TaskResponse(BaseModel):
    id: int
    user_id: int
    project_id: Optional[int] = None
    title: str
    description: Optional[str] = ""
    priority: Optional[str] = "medium"
    status: Optional[str] = "todo"
    deadline: Optional[datetime.datetime] = None
    order_index: Optional[int] = 0
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

    model_config = {"from_attributes": True}

    @field_validator("priority", "status", mode="before")
    @classmethod
    def lower_enums(cls, v):
        if isinstance(v, str):
            return v.lower()
        return v


class HabitCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    frequency: Optional[str] = "daily"
    times_per_day: Optional[int] = Field(1, ge=1, le=20)
    color: Optional[str] = "#6366f1"


class HabitUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    frequency: Optional[str] = None
    times_per_day: Optional[int] = Field(None, ge=1, le=20)
    color: Optional[str] = None


class HabitResponse(BaseModel):
    id: int
    user_id: int
    title: str
    description: Optional[str] = ""
    frequency: Optional[str] = "daily"
    times_per_day: int = 1
    today_count: int = 0
    streak: Optional[int] = 0
    last_completed: Optional[datetime.datetime] = None
    color: Optional[str] = "#6366f1"
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

    model_config = {"from_attributes": True}

    @field_validator("frequency", mode="before")
    @classmethod
    def lower_frequency(cls, v):
        if isinstance(v, str):
            return v.lower()
        return v


class HabitLogResponse(BaseModel):
    id: int
    habit_id: int
    user_id: int
    completed_date: Optional[datetime.date] = None

    model_config = {"from_attributes": True}


class CalendarDay(BaseModel):
    date: str
    completed: bool
    count: int = 0
    target: int = 1
