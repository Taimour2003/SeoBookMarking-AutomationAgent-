from data_source.data_navigator import DataNavigator
from panel.safely_install_panel import safely_install_panel

from browser.active_page_manager import ActivePageManager
from browser.challenge_detector import detect_security_page
from browser.control_panel import (
    set_ai_fix_enabled,
    set_panel_state,
    update_current_data_display,
    update_panel_status,
)


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

