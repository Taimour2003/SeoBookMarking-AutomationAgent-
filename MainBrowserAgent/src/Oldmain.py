import asyncio

from  browser.browser_manager import BrowserManager
from  browser.control_panel import (
    install_control_panel,
    set_ai_fix_enabled,
    update_panel_status,
    wait_for_panel_action,
)
from  config import settings
from  data_source.local_data_service import LocalDataService
from playwright.async_api import async_playwright
from  submission.assistant import SubmissionAssistant

from  browser.active_page_manager import (
    ActivePageManager,
)
from  browser.challenge_detector import (
    detect_security_page,
)

def get_ai_mode(
    result: dict,
) -> str | None:
    status = result.get("status")

    fixable_statuses = {
        "VALIDATION_FAILED",
        "FIELD_VALUE_INVALID",
        "DESCRIPTION_TOO_SHORT",
        "DESCRIPTION_TOO_LONG",
        "TITLE_TOO_SHORT",
        "TITLE_TOO_LONG",
        "CATEGORY_INVALID",
        "TAGS_INVALID",
    }

    consultant_statuses = {
        "SUBMISSION_UNVERIFIED",
        "UNKNOWN_VALIDATION_ERROR",
        "FORM_STATE_UNKNOWN",
    }

    if status in fixable_statuses:
        return "FIX"

    if status in consultant_statuses:
        return "CONSULT"

    return None


def should_enable_ai_fix(
    result: dict,
) -> bool:
    ai_fixable_statuses = {
        "VALIDATION_FAILED",
        "SUBMISSION_UNVERIFIED",
        "FIELD_VALUE_INVALID",
        "DESCRIPTION_TOO_SHORT",
        "DESCRIPTION_TOO_LONG",
        "TITLE_TOO_SHORT",
        "TITLE_TOO_LONG",
        "CATEGORY_INVALID",
        "TAGS_INVALID",
    }

    return (
        not result.get("success", False) and result.get("status") in ai_fixable_statuses
    )


async def main():
    data_service = LocalDataService(str(settings.current_record_path))

    assistant = SubmissionAssistant()

    print("Submission agent started.")

    browser_manager = BrowserManager(settings)
    # print()

    async with async_playwright() as playwright:
        try:
            page = await browser_manager.start(playwright)
            
            if not browser_manager.context:
                raise RuntimeError("Browser context is not started.")
            
            page_manager = ActivePageManager(
                browser_manager.context,
                page,
            )
            

            async def reinject_panel():
                try:
                    await install_control_panel(page)
                except Exception:  # noqa: BLE001, S110
                    pass

            page.on(
                "domcontentloaded",
                lambda: asyncio.create_task(reinject_panel()),
            )

            await page.goto(
                settings.start_url,
                wait_until="domcontentloaded",
            )

            print(
                "Browser ready.",
                page.url,
            )

            print(
                "Website manually open karein, "
                "login/signup karein aur "
                "submission form tak jayein."
            )

            while True:
                try:
                    installed = await install_control_panel(page)

                    if not installed:
                        await asyncio.sleep(1)
                        continue

                    action = await wait_for_panel_action(page)

                    if action in {
                        None,
                        "",
                        "NO_ACTION",
                    }:
                        await asyncio.sleep(0.2)
                        continue

                    if action == "FILL":
                        await update_panel_status(
                            page,
                            ("Reading data and filling form..."),
                        )

                        data = data_service.get_current_record()

                        result = await assistant.fill_current_page(
                            page,
                            data,
                        )

                        filled = ", ".join(
                            result.get(
                                "filled_fields",
                                [],
                            )
                        )

                        unresolved_count = len(
                            result.get(
                                "unresolved_fields",
                                [],
                            )
                        )

                        skipped_count = len(
                            result.get(
                                "skipped_fields",
                                [],
                            )
                        )

                        failed_count = len(
                            result.get(
                                "failed_fields",
                                [],
                            )
                        )

                        await update_panel_status(
                            page,
                            (
                                f"Filled: "
                                f"{filled or 'none'}. "
                                f"Skipped: "
                                f"{skipped_count}. "
                                f"Failed: "
                                f"{failed_count}. "
                                f"Unresolved: "
                                f"{unresolved_count}."
                            ),
                        )

                        # AI button sirf validation
                        # error ke baad enable hoga.
                        await set_ai_fix_enabled(
                            page,
                            False,
                        )

                        print(
                            "Fill result:",
                            result,
                        )

                    elif action == "SUBMIT":
                        await update_panel_status(
                            page,
                            "Submitting form...",
                        )

                        result = await assistant.submit_current_page(page)

                        print(
                            "Submit result:",
                            result,
                        )

                        # Submit ke baad navigation,
                        # AJAX update ya page reload
                        # ho sakti hai.
                        try:
                            await page.wait_for_load_state(
                                "domcontentloaded",
                                timeout=10_000,
                            )
                        except Exception:
                            pass

                        # Naye DOM mein panel pehle
                        # dobara create karein.
                        await install_control_panel(page)

                        await update_panel_status(
                            page,
                            result.get(
                                "message",
                                result.get(
                                    "status",
                                    "UNKNOWN",
                                ),
                            ),
                        )

                        ai_mode = get_ai_mode(result)

                        await set_ai_fix_enabled(
                            page,
                            ai_mode is not None,
                        )

                    elif action == "AI_FIX":
                        ai_mode = get_ai_mode(assistant.last_submit_result)
                        if ai_mode is None:
                            await update_panel_status(
                                page,
                                "AI fix not available for this submission.",
                            )
                            continue
                        # await update_panel_status(
                        #     page,
                        #     ("AI is analysing validation errors..."),
                        # )

                        result = await assistant.ai_fix_and_resubmit(page)

                        print(
                            "AI fix result:",
                            result,
                        )

                        # AI auto-resubmit ke baad
                        # page navigate kar sakta hai.
                        try:
                            await page.wait_for_load_state(
                                "domcontentloaded",
                                timeout=10_000,
                            )
                        except Exception:
                            pass

                        await install_control_panel(page)

                        await update_panel_status(
                            page,
                            result.get(
                                "message",
                                result.get(
                                    "status",
                                    "AI fix completed",
                                ),
                            ),
                        )

                        await set_ai_fix_enabled(
                            page,
                            should_enable_ai_fix(result),
                        )

                    elif action == "REFRESH":
                        await install_control_panel(page)

                        await update_panel_status(
                            page,
                            "Agent refreshed.",
                        )

                    else:
                        print(
                            "Unknown panel action:",
                            action,
                        )

                except Exception as error:
                    print(
                        "Agent loop error:",
                        str(error),
                    )

                    try:
                        await page.wait_for_load_state(
                            "domcontentloaded",
                            timeout=10_000,
                        )
                    except Exception:
                        pass

                    await asyncio.sleep(1)

        finally:
            await browser_manager.close()


if __name__ == "__main__":
    asyncio.run(main())
