from typing import Any

from .ai_mode_getter import get_ai_mode
from browser.control_panel import update_panel_status
from playwright.async_api import Page
from submission.assistant import SubmissionAssistant


async def handle_ai_action(
    page: Page,
    assistant: SubmissionAssistant,
) -> dict[str, Any]:
    last_result = getattr(
        assistant,
        "last_submit_result",
        None,
    )

    ai_mode = get_ai_mode(last_result)

    if ai_mode is None:
        return {
            "success": False,
            "status": "AI_NOT_AVAILABLE",
            "message": (
                "AI is not available for this result. Manual action may be required."
            ),
        }

    if ai_mode == "FIX":
        await update_panel_status(
            page,
            "AI is analysing validation errors...",
        )

        return await assistant.ai_fix_and_resubmit(page)

    consultant_method = getattr(
        assistant,
        "ai_consult",
        None,
    )

    if not callable(consultant_method):
        return {
            "success": False,
            "status": "AI_CONSULTANT_NOT_IMPLEMENTED",
            "message": (
                "Consultant mode was selected, but "
                "SubmissionAssistant.ai_consult() is not implemented yet."
            ),
        }

    return await consultant_method(page)
