from playwright.async_api import Page

from browser.active_page_manager import ActivePageManager
from browser.control_panel import consume_panel_action


async def find_clicked_action(
    page_number: ActivePageManager,
) -> tuple[Page | None, str | None]:
    for page in page_number.pages():
        action = await consume_panel_action(page)
        if action:
            page_number.mark_interacted(page)
            return page, action
    return None, None
