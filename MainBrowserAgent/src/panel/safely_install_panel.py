from browser.control_panel import install_control_panel
from playwright.async_api import Page


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
