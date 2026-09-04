import asyncio
from playwright.async_api import Page
from .signup_page_navigator import find_signup_url
from browser.control_panel import (
    update_current_data_display,
)
from panel import safely_install_panel


async def process_url(context, url, failed_urls, timeout_ms):
    page: Page | None = None

    closed_event = asyncio.Event()

    try:
        page = await context.new_page()
        print(f"Worker processing: {url}")
        page.on("close", lambda: closed_event.set())  # Wait until the page is closed

        print(f"Navigating to: {url}")

        signup_url = await find_signup_url(page, url, timeout_ms=timeout_ms)
        if signup_url:
            print(f"[SIGNUP FOUND] Signup Page: {signup_url}")
        else:
            print(f"[NO SIGNUP] No signup page found for: {url}")


        await closed_event.wait()  # Wait until the page is closed

        return True

    except Exception as e:
        print(f"Error processing {url}: {e}")

        failed_urls.append(url)

        if page and not page.is_closed():
            await page.close()  # Close the page on error

        return False
