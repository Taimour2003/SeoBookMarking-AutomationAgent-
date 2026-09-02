from typing import Any

from .ai_mode_getter import get_ai_mode
from browser.control_panel import (
    set_ai_fix_enabled,
    set_panel_state,
    update_panel_status,
)
from playwright.async_api import Page


async def update_ai_state(
    page: Page,
    result: dict[str, Any] | None,
) -> str | None:
    ai_mode = get_ai_mode(result)

    await set_ai_fix_enabled(
        page,
        ai_mode is not None,
    )

    if not result:
        await set_panel_state(
            page,
            "ready",
        )
        await update_panel_status(
            page,
            "No submission result is available.",
        )
        return None

    if ai_mode == "FIX":
        errors = result.get("errors") or []
        first_error = (
            str(errors[0])
            if errors
            else result.get(
                "message",
                "Validation error detected.",
            )
        )

        await set_panel_state(page, "ai")
        await update_panel_status(
            page,
            f"{first_error} AI Fix is available.",
        )

        return

    elif ai_mode == "CONSULT":
        await set_panel_state(page, "ai")
        await update_panel_status(
            page,
            "Submission result is unclear. AI Consultant is available.",
        )

    elif result.get("success"):
        await set_panel_state(page, "ready")
        await update_panel_status(
            page,
            result.get(
                "message",
                "Submission successful.",
            ),
        )

    else:
        await set_panel_state(page, "ai")
        await update_panel_status(
            page,
            result.get(
                "message",
                "Human action is required.",
            ),
        )

    return ai_mode

