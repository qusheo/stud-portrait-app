from portrait.constants import RsvCompetencies as COMP, RsvMotivators as MOT, RsvValues as VAL

PROJECT_TYPE_RSV = {
    "social": {
        "competencies": [COMP.EMOTE_INTEL, COMP.COMMUNICATION, COMP.PARTNERSHIP],
        "motivators": [MOT.ALTRUISM, MOT.PURPOSE, MOT.COOPERATION],
        "values": [VAL.HUMANISM, VAL.HONEST_JUST],
    },
    "education": {
        "competencies": [COMP.INFO_ANALYSIS, COMP.SELF_DEVELOP, COMP.COMMUNICATION],
        "motivators": [MOT.SELF_DEVELOP, MOT.CHALLENGE],
        "values": [],
    },
    "ecology": {
        "competencies": [COMP.RESULT_ORIENT, COMP.PARTNERSHIP],
        "motivators": [MOT.PURPOSE, MOT.ALTRUISM],
        "values": [VAL.ENVIRONMENT],
    },
    "health_sport": {
        "competencies": [COMP.RESULT_ORIENT, COMP.SELF_DEVELOP],
        "motivators": [MOT.CHALLENGE, MOT.SELF_DEVELOP],
        "values": [VAL.HEALTH],
    },
    "culture": {
        "competencies": [COMP.SELF_DEVELOP, COMP.COMMUNICATION],
        "motivators": [MOT.CREATIVITY, MOT.AUTONOMY],
        "values": [],
    },
    "media": {
        "competencies": [COMP.COMMUNICATION, COMP.PLANNING],
        "motivators": [MOT.CREATIVITY, MOT.RECOGNITION],
        "values": [],
    },
    "technology": {
        "competencies": [COMP.INFO_ANALYSIS, COMP.PLANNING],
        "motivators": [MOT.CHALLENGE, MOT.SELF_DEVELOP],
        "values": [],
    },
    "business": {
        "competencies": [COMP.RESULT_ORIENT, COMP.LEADERSHIP, COMP.PLANNING],
        "motivators": [MOT.AUTONOMY, MOT.MARAGEMENT, MOT.CAREER],
        "values": [],
    },
    "society": {
        "competencies": [COMP.PARTNERSHIP, COMP.COMMUNICATION],
        "motivators": [MOT.COOPERATION, MOT.PURPOSE],
        "values": [VAL.HUMANISM, VAL.HONEST_JUST],
    },
    "events": {
        "competencies": [COMP.PLANNING, COMP.COMMUNICATION, COMP.PARTNERSHIP],
        "motivators": [MOT.COOPERATION, MOT.MARAGEMENT],
        "values": [],
    },
}

def motivation_score(value: float | None) -> float | None:
    if value is None or not 200 <= value <= 800:
        return None
    if value < 400:
        return -(400 - value) / 200
    if value < 600:
        return 0.0
    return (value - 600) / 200


def value_score(value: float | None) -> float | None:
    if value is None or not 200 <= value <= 800:
        return None
    return max(0.0, (value - 600) / 200)


def competency_score(value: float | None) -> float | None:
    if value is None or not 200 <= value <= 800:
        return None
    return (value - 200) / 600

def calculate_project_type_score(profile: dict, project_type: str) -> dict:
    config = PROJECT_TYPE_RSV[project_type]
    calculators = {
        "competencies": competency_score,
        "motivators": motivation_score,
        "values": value_score,
    }

    scores = {}

    for category, fields in config.items():
        values = [
            score
            for field in fields
            if (score := calculators[category](profile.get(field))) is not None
        ]
        scores[category] = sum(values) / len(values) if values else None

    weights = {"competencies": 0.2, "motivators": 0.6, "values": 0.2}
    available = [(scores[key], weight) for key, weight in weights.items() if scores[key] is not None]

    total = sum(score * weight for score, weight in available) / sum(weight for _, weight in available) if available else None

    return {
        "projectType": project_type,
        "score": round(total, 4) if total is not None else None,
        "details": {key: round(value, 4) if value is not None else None for key, value in scores.items()},
    }