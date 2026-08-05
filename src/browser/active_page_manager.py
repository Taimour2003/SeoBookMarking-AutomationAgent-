from __future__ import annotations

from playwright.async_api import (
    BrowserContext,
    Page,
)


class ActivePageManager:
    def __init__(
        self,
        context: BrowserContext,
        initial_page: Page,
    ):
        self.context = context
        self.current_page = initial_page

        self.context.on(
            "page",
            self._handle_new_page,
        )

        for page in self.context.pages:
            self._register_page(page)

    def _handle_new_page(
        self,
        page: Page,
    ) -> None:
        self.current_page = page
        self._register_page(page)

        print(
            "New active tab detected:",
            page.url,
        )

    def _register_page(
        self,
        page: Page,
    ) -> None:
        page.on(
            "domcontentloaded",
            lambda: self._set_current_page(page),
        )

        page.on(
            "close",
            lambda: self._handle_page_closed(page),
        )

    def _set_current_page(
        self,
        page: Page,
    ) -> None:
        if not page.is_closed():
            self.current_page = page

    def _handle_page_closed(
        self,
        closed_page: Page,
    ) -> None:
        if self.current_page != closed_page:
            return

        available_pages = [
            page
            for page in self.context.pages
            if not page.is_closed()
        ]

        self.current_page = (
            available_pages[-1]
            if available_pages
            else None
        )

    def get_current_page(
        self,
    ) -> Page:
        if (
            self.current_page
            and not self.current_page.is_closed()
        ):
            return self.current_page

        available_pages = [
            page
            for page in self.context.pages
            if not page.is_closed()
        ]

        if not available_pages:
            raise RuntimeError(
                "No active browser page found."
            )

        self.current_page = available_pages[-1]

        return self.current_page