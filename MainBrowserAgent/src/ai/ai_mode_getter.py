
from typing import Any

AI_FIXABLE_STATUSES = {
    "VALIDATION_FAILED",
    "FIELD_VALUE_INVALID",
    "DESCRIPTION_TOO_SHORT",
    "DESCRIPTION_TOO_LONG",
    "TITLE_TOO_SHORT",
    "TITLE_TOO_LONG",
    "CATEGORY_INVALID",
    "TAGS_INVALID",
}

AI_CONSULTANT_STATUSES = {
    "SUBMISSION_UNVERIFIED",
    "UNKNOWN_VALIDATION_ERROR",
    "FORM_STATE_UNKNOWN",
}


def get_ai_mode(
    result: dict[str, Any] | None,
) -> str | None:
    if not result:
        return None

    status = result.get("status")

    if status in AI_FIXABLE_STATUSES:
        return "FIX"

    if status in AI_CONSULTANT_STATUSES:
        return "CONSULT"

    return None
