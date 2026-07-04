"""API tests for Tasks/Habits page UI button actions."""
import pytest

from ui_action_registry import TASKS_ACTIONS, UiAction

pytest_plugins = ["test_tasks"]

pytestmark = pytest.mark.asyncio


async def _resolve_path(action: UiAction, ids: dict) -> str:
    if action.setup and "{id}" in action.path:
        return action.path.replace("{id}", str(ids[action.setup]))
    return action.path


async def _request(client, action: UiAction, ids: dict):
    path = await _resolve_path(action, ids)

    if action.method == "GET":
        return await client.get(path)

    if action.method == "POST":
        return await client.post(path, json=action.body or {})

    if action.method == "PATCH":
        return await client.patch(path, json=action.body or {"status": "done"})

    pytest.fail(f"Unknown method {action.method}")


@pytest.fixture
async def tasks_ids(client):
    task = await client.post("/api/tasks", json={"title": "UI task"})
    habit = await client.post("/api/habits", json={"title": "UI habit", "frequency": "daily"})
    return {"task_id": task.json()["id"], "habit_id": habit.json()["id"]}


@pytest.mark.parametrize("action", TASKS_ACTIONS, ids=lambda a: f"{a.page}:{a.button}")
async def test_tasks_ui_button_api(client, tasks_ids, action: UiAction):
    resp = await _request(client, action, tasks_ids)
    assert resp.status_code in (200, 201, 204), f"{action.button}: {resp.status_code} {resp.text}"
