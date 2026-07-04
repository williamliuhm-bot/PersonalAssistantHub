import re

INSIGHT_EXACT: dict[str, str] = {
    "Not enough data for productivity analysis.": "Недостаточно данных для анализа продуктивности.",
    "No insights available yet.": "Инсайты пока недоступны.",
    "Productivity and expenses show a moderate relationship.": "Продуктивность и расходы связаны умеренно.",
    "No significant correlation between productivity and entertainment expenses detected.": (
        "Значимой связи между продуктивностью и расходами на развлечения не обнаружено."
    ),
}

INSIGHT_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(r"^Completed (\d+) tasks with \$([\d.]+) in expenses\.$"),
        r"Выполнено задач: \1, расходы: \2 $.",
    ),
    (
        re.compile(r"^On low productivity days, entertainment expenses are ([\d.]+)% higher$"),
        r"В дни с низкой продуктивностью расходы на развлечения на \1% выше",
    ),
    (
        re.compile(r"^On low productivity days, entertainment expenses are ([\d.]+)% lower$"),
        r"В дни с низкой продуктивностью расходы на развлечения на \1% ниже",
    ),
]

RECOMMENDATION_EXACT: dict[str, str] = {
    "On track to stay within budget.": "Расходы укладываются в бюджет.",
    "Your budget looks healthy. Keep up the good financial habits.": "Бюджет в норме. Продолжайте в том же духе.",
    "Set a budget limit to enable forecasting and risk assessment.": (
        "Задайте лимит бюджета, чтобы включить прогноз и оценку рисков."
    ),
    "Your predicted expenses are approaching your budget limit. Monitor your spending closely.": (
        "Прогноз расходов приближается к лимиту бюджета. Следите за тратами."
    ),
    "Your predicted expenses exceed 90% of your budget limit. Consider reducing discretionary spending.": (
        "Прогноз расходов превышает 90% лимита бюджета. Рекомендуем сократить необязательные траты."
    ),
}

RECOMMENDATION_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(
            r"^Predicted expenses: \$([\d.]+)\. Budget limit: \$([\d.]+)\. Risk: (\w+)\.$"
        ),
        r"Прогноз расходов: \1 $, лимит бюджета: \2 $. Риск: \3.",
    ),
]


def localize_insight(text: str | None) -> str:
    if not text:
        return "Инсайты пока недоступны."
    if text in INSIGHT_EXACT:
        return INSIGHT_EXACT[text]
    for pattern, replacement in INSIGHT_PATTERNS:
        if pattern.match(text):
            return pattern.sub(replacement, text)
    return text


def localize_recommendation(text: str | None) -> str | None:
    if not text:
        return text
    if text in RECOMMENDATION_EXACT:
        return RECOMMENDATION_EXACT[text]
    for pattern, replacement in RECOMMENDATION_PATTERNS:
        if pattern.match(text):
            return pattern.sub(replacement, text)
    return text
