import asyncio
from typing import Any

from playwright.async_api import Page, async_playwright

from browser.active_page_manager import ActivePageManager
from browser.browser_manager import BrowserManager
from browser.challenge_detector import detect_security_page
from browser.control_panel import (
    install_control_panel,
    set_ai_fix_enabled,
    update_panel_status,
    # wait_for_panel_action,
    set_panel_state,
    consume_panel_action,
)
from config import settings
from data_source.local_data_service import LocalDataService
from submission.assistant import SubmissionAssistant

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


async def safely_install_panel(
    page: Page,
) -> bool:
    if page.is_closed():
        return False

    try:
        return await install_control_panel(page)
    except Exception as error:
        print(
            "Control panel installation error:",
            str(error),
        )
        return False


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

    # await update_panel_status(
    #     page,
    #     "AI Consultant is analysing the current issue...",
    # )

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


async def prepare_all_pages(page_manager: ActivePageManager) -> None:
    for page in page_manager.pages():
        await safely_install_panel(page)
        
        security_status = await detect_security_page(page)
        if security_status:
            await set_panel_state(page,"blocked")
            await set_ai_fix_enabled(page, False)
            await update_panel_status(
                page,
                f"Security challenge detected: {security_status}. ")


async def find_clicked_action(
    page_number:ActivePageManager
)-> tuple[Page | None, str | None]:
    for page in page_number.pages():
        action = await consume_panel_action(page)
        if action:
            page_number.mark_interacted(page)
            return page, action
    return None, None   


async def main() -> None:
    data_service = LocalDataService(str(settings.current_record_path))

    assistant = SubmissionAssistant()
    browser_manager = BrowserManager(settings)

    print("Submission agent started.")

    async with async_playwright() as playwright:
        try:
            initial_page = await browser_manager.start(playwright)

            if not browser_manager.context:
                raise RuntimeError("Browser context is not available.")

            page_manager = ActivePageManager(
                browser_manager.context,
                initial_page,
            )

            # browser_mode = (
            #     getattr(
            #         settings,
            #         "browser_mode",
            #         "cdp",
            #     )
            #     .strip()
            #     .lower()
            # )

            if settings.browser_mode == "playwright":
                await initial_page.goto(
                    settings.start_url,
                    wait_until="domcontentloaded",
                )

            print(
                "Browser ready.",
                initial_page.url,
            )

            print(
                "Website manually open karein, "
                "login/signup karein aur "
                "submission form tak jayein."
            )

            paused_status: str | None = None
            paused_url: str | None = None

            while True:
                try:
                    await prepare_all_pages(page_manager)
                    page,action = await find_clicked_action(page_manager)

                    security_status = await detect_security_page(page)

                    # if security_status:
                    #     if (
                    #         security_status != paused_status
                    #         or page.url != paused_url
                    #     ):
                    #         print(
                    #             "WebAgent paused:",
                    #             security_status,
                    #             page.url,
                    #         )
                    #         paused_status = security_status
                    #         paused_url = page.url

                    #     await asyncio.sleep(2)
                    #     continue

                    # if paused_status:
                    #     print(
                    #         "Security challenge cleared. WebAgent resumed:",
                    #         page.url,
                    #     )
                    #     paused_status = None
                    #     paused_url = None

                    if action == "FILL":

                        if security_status in {"CLOUDFLARE_REQUIRED","MANUAL_LOGIN_REQUIRED"}:
                            await set_panel_state(
                                page,"blocked")
                            await update_panel_status(
                                page,
                                "Cloudflare verification must be completed manually.",
                            )
                            continue

                        await update_panel_status(
                            page,
                            "Reading data and filling form...",
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
                        
                        await set_ai_fix_enabled(page,False)
                        await set_panel_state(
                            page,
                            "error" if failed_count else "ready"
                        )

                        await update_panel_status(
                            page,
                            (
                                f"Filled: {filled or 'none'}. "
                                f"Skipped: {skipped_count}. "
                                f"Failed: {failed_count}. "
                                f"Unresolved: {unresolved_count}."
                            ),
                        )


                    elif action == "SUBMIT":
                        # result = await assistant.submit_current_page(page)

                        # security_status = await detect_security_page(page)

                        if security_status:
                            await set_panel_state(
                                page,
                                "blocked",
                            )
                            await update_panel_status(
                                page,
                                "Security verification appeared. Complete it manually.",
                            )
                            print(
                                "Security challenge detected:",
                                security_status,
                                page.url,
                            )
                            continue

                        await update_panel_status(
                            page,
                            "Submitting form...",
                        )

                        result = await assistant.submit_current_page(page)

                        # print(
                        #     "Submit result:",
                        #     result,
                        # )
                        
                        post_submit_security= await detect_security_page(page)
                        
                        if post_submit_security:
                            await safely_install_panel(page)
                            await set_panel_state(page, "blocked")
                            await set_ai_fix_enabled(page, False)
                            await update_panel_status(
                                page,
                                "Security verification appeared. Complete it manually.",
                            )
                            print(
                                "Security verification appeared after submission:",
                                post_submit_security,
                            )
                            continue
                            

                        # try:
                        #     await page.wait_for_load_state(
                        #         "domcontentloaded",
                        #         timeout=10_000,
                        #     )
                        # except Exception:
                        #     pass

                        # page = page_manager.get_current_page()
                        print(
                            "Submit result:",
                            result,
                        )
                        await safely_install_panel(page)
                        await update_ai_state(
                            page,
                            result,
                        )

                        # result = await assistant.submit_current_page(page)

                        # security_status = await detect_security_page(page)

                        # if security_status:
                        #     await update_panel_status(
                        #         page,
                        #         "Security verification appeared. Complete it manually.",
                        #     )

                    elif action == "AI_FIX":
                        if security_status:
                            await set_panel_state(
                                page,
                                "blocked",
                            )
                            await update_panel_status(
                                page,
                                "Security verification appeared. Complete it manually.",
                            )
                            print(
                                "Security challenge detected:",
                                security_status,
                                page.url,
                            )
                            continue
                        
                        result = await handle_ai_action(
                            page,
                            assistant,
                        )

                        print(
                            "AI action result:",
                            result,
                        )

                        await safely_install_panel(page)
                        await update_ai_state(
                            page,
                            result,
                        )

                    elif action == "REFRESH":
                        await safely_install_panel(page)
                        await set_panel_state(
                            page,"ready")
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
                    await asyncio.sleep(1)

        finally:
            await browser_manager.close()


if __name__ == "__main__":
    asyncio.run(main())


                    # installed = await safely_install_panel(page)

                    # if not installed:
                    #     await asyncio.sleep(1)
                    #     continue

                    # if security_status:
                    #     print(
                    #         "Security challenge detected:",
                    #         security_status,
                    #         page.url,
                    #     )
                    #     await update_panel_status(
                    #         page,
                    #         f"Security challenge detected: {security_status}. "
                    #         "Please resolve it manually.",
                    #     )
                    #     await set_ai_fix_enabled(
                    #         page,
                    #         False,
                    #     )

                    # action = await wait_for_panel_action(page)

                    # if action in {
                    #     None,
                    #     "",
                    #     "NO_ACTION",
                    # }:
                    #     await asyncio.sleep(0.2)
                    #     continue