import asyncio
from tkinter import Tk, filedialog
import pandas as pd
from typing import Any

from playwright.async_api import Page, async_playwright

from browser.active_page_manager import ActivePageManager
from browser.browser_manager import BrowserManager
from browser.challenge_detector import detect_security_page
from browser.control_panel import (
    consume_panel_action,
    install_control_panel,
    set_ai_fix_enabled,
    set_panel_state,
    update_current_data_display,
    update_panel_status,
)
from config import settings
from data_source.data_navigator import (
    DataNavigator,
)
from data_source.data_parser import parse_sheet_entries
from submission.assistant import SubmissionAssistant

from actions.url_entry_action import enter_current_url

import gspread

from google_sheets.published_url_sheets import PublishedUrlSheets

from core.signup_page_navigator import is_valid_signup_page, find_signup_url

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
        print("Page is closed, cannot install control panel.")
        return False

    try:
        # print("installing")
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


async def prepare_all_pages(
    page_manager: ActivePageManager,
    data_navigator: DataNavigator,
) -> None:
    for page in page_manager.pages():
        installed = await safely_install_panel(page)

        # print("installed", installed)

        if not installed:
            continue

        await update_current_data_display(
            page,
            data_navigator.current_data(),
            data_navigator.position(),
        )

        security_status = await detect_security_page(page)

        if security_status:
            await set_panel_state(
                page,
                "blocked",
            )

            await set_ai_fix_enabled(
                page,
                False,
            )

            await update_panel_status(
                page,
                (f"Security challenge detected: {security_status}."),
            )


import asyncio
from playwright.async_api import TimeoutError


async def open_single_url(
    context, url, timeout_failed_list, semaphore, timeout_ms=10000
):
    """Ek single URL ko async load karega. Timeout hone par array mein add kar dega."""
    async with semaphore:  # Ek waqt mein browser par over-load na pade
        page = None
        closed_event = asyncio.Event()

        try:
            page = await context.new_page()
            # Signup page check karne ke liye
            print(f"Starting: {url}")
            page.on(
                "close", lambda: closed_event.set()
            )  # Page close hone par event set kar do

            # signup_url = await find_signup_url(page, url)
            # if signup_url:
            #     print(f"[SIGNUP FOUND] Signup Page: {signup_url}")
            #     await page.goto(signup_url, wait_until="commit", timeout=timeout_ms)

            # else:
            #     print(f"[NO SIGNUP] No signup page found for: {url}")
            #     await page.goto(url, wait_until="commit", timeout=timeout_ms)

            # Non-blocking page load (10 sec timeout)
            await page.goto(url, wait_until="commit", timeout=timeout_ms)
            print(f"Successfully loaded: {url}")
            await closed_event.wait()  # Wait until the page is closed

        except (TimeoutError, Exception) as e:
            print(f"Timeout/Failed for {url}")
            timeout_failed_list.append(url)
            if page and not page.is_closed():
                await page.close()  # Timeout wala tab close kar do
            return None


async def find_clicked_action(
    page_number: ActivePageManager,
) -> tuple[Page | None, str | None]:
    for page in page_number.pages():
        action = await consume_panel_action(page)
        if action:
            page_number.mark_interacted(page)
            return page, action
    return None, None


def get_data_from_uploaded_file() -> list[list[str]]:
    print("Enter in the get_data_from_uploaded_file function")
    root = Tk()
    root.withdraw()  # Hide the main window
    root.attributes("-topmost", True)  # Bring the file dialog to the front

    print("Waiting for user to select a file...")
    file_path = filedialog.askopenfilename(
        title="Select Excel or CSV sheet file",
        filetypes=[("Excel/CSV Files", "*.xlsx *.xls *.csv"), ("All files", "*.*")],
    )
    root.destroy()  # Close the Tkinter root window after file selection
    if not file_path:
        raise RuntimeError("No file selected. Please select a valid Excel or CSV file.")

    print(f"File selected: {file_path}")

    if file_path.endswith(".csv"):
        df = pd.read_csv(file_path, header=None)
    else:
        df = pd.read_excel(file_path, header=None)

    df = df.fillna("")  # Replace NaN with empty strings

    return df.astype(
        str
    ).values.tolist()  # Convert DataFrame to list of lists of strings


async def load_sheet_navigator():
    print("enter in the load sheet navigator function")
    sheet_data = get_data_from_uploaded_file()
    # print("Data loaded from file:", sheet_data)
    parsed_entries = parse_sheet_entries(sheet_data)
    if not parsed_entries:
        raise RuntimeError("No valid entries found in the Google Sheet.")

    data_navigator = DataNavigator(parsed_entries)
    current_data = data_navigator.current_data()

    return data_navigator, current_data


def fetchUrlsFromSheet() -> list[str]:
    spreadsheet_id = settings.BookmarkingSitesSheetId
    worksheet_name = settings.BookmarkingSitesSheetName
    credentials_file = settings.GOOGLE_SERVICE_ACCOUNT_FILE

    print("Fetching URLs from Google Sheet...")
    print(f"Spreadsheet ID: {spreadsheet_id}")
    print(f"Worksheet Name: {worksheet_name}")
    print(f"Credentials File: {credentials_file}")

    if not spreadsheet_id or not worksheet_name or not credentials_file:
        raise ValueError(
            "Google Sheet ID, worksheet name, or credentials file is not set in the environment variables."
        )

    gc = gspread.service_account(filename=credentials_file)

    sh = gc.open_by_key(spreadsheet_id)
    worksheet = sh.worksheet(worksheet_name)

    urls = worksheet.col_values(1)  # Assuming URLs are in the first column

    cleaned_urls = [
        url.strip() for url in urls if url.strip()
    ]  # Remove empty and whitespace-only entries

    return cleaned_urls


async def main():

    try:
        urls_from_sheet = fetchUrlsFromSheet()
        print("Fetched URLs from Google Sheet:", urls_from_sheet)

    except Exception as e:
        print("Error fetching URLs from Google Sheet:", str(e))
        return

    data_navigator, current_data = await load_sheet_navigator()
    print("innitial data loaded from Google Sheet:", current_data)
    # Apni Google Sheet ka exact naam yahan likhein
    # data_service = LocalDataService(str(settings.current_record_path))

    assistant = SubmissionAssistant()
    browser_manager = BrowserManager(settings)
    published_url_sheets = PublishedUrlSheets()

    timeout_failed_urls = []  # Timeout hone wale URLs ka list

    max_concurrent_pages = 5  # Ek waqt mein maximum 5 pages load karenge
    semaphore = asyncio.Semaphore(max_concurrent_pages)

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

            opened_pages = []

            tasks = [
                open_single_url(
                    browser_manager.context, url, timeout_failed_urls, semaphore, 10000
                )
                for url in urls_from_sheet
            ]

            results = await asyncio.gather(*tasks)
            opened_pages = [page for page in results if page is not None]

            print("\n--- Summary ---")
            print("Successfully opened tabs:", len(opened_pages))
            print("Failed/Timeout URLs array:", timeout_failed_urls)

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
                    await prepare_all_pages(page_manager, data_navigator)
                    page, action = await find_clicked_action(page_manager)

                    if page is None or action is None:
                        await asyncio.sleep(0.1)
                        continue

                    security_status = await detect_security_page(page)

                    if action == "FILL":
                        if security_status in {
                            "CLOUDFLARE_REQUIRED",
                            "MANUAL_LOGIN_REQUIRED",
                        }:
                            await set_panel_state(page, "blocked")
                            await update_panel_status(
                                page,
                                "Cloudflare verification must be completed manually.",
                            )
                            continue

                        await update_panel_status(
                            page,
                            "Reading data and filling form...",
                        )

                        data = data_navigator.current_data()

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

                        await set_ai_fix_enabled(page, False)
                        await set_panel_state(
                            page, "error" if failed_count else "ready"
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
                        print("Submit result:", result)
                        if result.get("success"):
                            print("Form submitted successfully.")
                            published_url = result.get("published_url")
                            published_url_sheets.submitted_Url(published_url)
                            published_url_sheets.display_urls()
                        post_submit_security = await detect_security_page(page)

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

                        print(
                            "Submit result:",
                            result,
                        )
                        await safely_install_panel(page)
                        await update_ai_state(
                            page,
                            result,
                        )

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
                        await set_panel_state(page, "ready")
                        await update_panel_status(
                            page,
                            "Agent refreshed.",
                        )

                    elif action == "CURRENT_DATA":
                        current_data = data_navigator.current_data()

                        position = data_navigator.position()

                        await update_current_data_display(
                            page,
                            current_data,
                            position,
                            open_view=True,
                        )

                    elif action == "NEXT_DATA":
                        current_data = data_navigator.next_data()

                        position = data_navigator.position()

                        await update_current_data_display(
                            page,
                            current_data,
                            position,
                            open_view=False,
                        )

                        await update_panel_status(
                            page,
                            (
                                f"Next data selected. "
                                f"Entry "
                                f"{position['current']} "
                                f"of "
                                f"{position['total']}."
                            ),
                        )

                        print(
                            "Current data changed to:",
                            current_data,
                        )

                    elif action == "PREVIOUS_DATA":
                        current_data = data_navigator.previous_data()

                        position = data_navigator.position()

                        await update_current_data_display(
                            page,
                            current_data,
                            position,
                            open_view=False,
                        )

                        await update_panel_status(
                            page,
                            (
                                f"Previous data selected. "
                                f"Entry "
                                f"{position['current']} "
                                f"of "
                                f"{position['total']}."
                            ),
                        )

                        print(
                            "Current data changed to:",
                            current_data,
                        )

                    elif action == "SUBMIT_URL":
                        current_data = data_navigator.current_data()

                        url = current_data.get(
                            "website_url", current_data.get("url", "")
                        )

                        if not url:
                            await set_panel_state(
                                page,
                                "error",
                            )

                            await update_panel_status(
                                page,
                                ("Current spreadsheet entry does not contain a URL."),
                            )

                            continue

                        print(
                            "Submitting URL to the website:",
                            url,
                        )

                        await update_panel_status(
                            page,
                            f"Submitting URL: {url}",
                        )

                        result = await enter_current_url(page, url)

                        print("SUBMIT_URL result:", result)

                    elif action == "SAVE_BACKLINK":
                        published_url = page.url
                        published_url_sheets.submitted_Url(published_url)
                        published_url_sheets.display_urls()
                        current_data = data_navigator.current_data()

                        # url = current_data.get("website_url", current_data.get("url", ""))

                        # if not url:
                        #     await set_panel_state(
                        #         page,
                        #         "error",
                        #     )

                        #     await update_panel_status(
                        #         page,
                        #         ("Current spreadsheet entry does not contain a URL."),
                        #     )

                        #     continue

                        # print(
                        #     "Fetching URL from the website:",
                        #     url,
                        # )

                        # await update_panel_status(
                        #     page,
                        #     f"Fetching URL: {url}",
                        # )
                        # result = await fetch_current_url(page, url)
                        # print("FETCH_URL result:", result)

                    elif action == "DOWNLOAD_SHEET":
                        print("Downloading updated spreadsheet...")
                        await update_panel_status(
                            page, "Downloading spreadsheet data..."
                        )

                        try:
                            # Save or export the updated spreadsheet file
                            filepath = await published_url_sheets.download_sheet()

                            await set_panel_state(page, "success")
                            await update_panel_status(
                                page, f"Sheet successfully downloaded: {filepath}"
                            )
                            print("Sheet downloaded successfully to:", filepath)
                        except Exception as error:
                            await set_panel_state(page, "error")
                            await update_panel_status(
                                page, f"Failed to download sheet: {str(error)}"
                            )
                            print("Error downloading sheet:", str(error))
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
