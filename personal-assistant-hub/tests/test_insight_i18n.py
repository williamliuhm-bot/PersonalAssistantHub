import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "integration-service"))

from app.insight_i18n import localize_insight, localize_recommendation


def test_localize_seed_insight():
    text = localize_insight("Completed 5 tasks with $294.89 in expenses.")
    assert text == "Выполнено задач: 5, расходы: 294.89 $."


def test_localize_static_insight():
    assert localize_insight("Not enough data for productivity analysis.") == (
        "Недостаточно данных для анализа продуктивности."
    )


def test_localize_recommendation():
    assert localize_recommendation("On track to stay within budget.") == (
        "Расходы укладываются в бюджет."
    )
