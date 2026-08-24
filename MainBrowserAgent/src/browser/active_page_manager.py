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
        self.last_interacted_page: Page | None = initial_page
        self._registered_ids: set[int] = set()

        for page in context.pages:
            self.register(page)

        context.on("page", self.register)

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

    def register(
        self,
        page: Page,
    ) -> None:
        
        page_id=id(page)
        if page_id in self._registered_ids:
            return
        
        self._registered_ids.add(page_id)
        self.last_interacted_page = page
        
        page.on(
            "domcontentloaded",
            lambda: self._mark_loaded(page),
        )

        page.on(
            "close",
            lambda: self._handle_close(page),
        )

    def _mark_loaded(
        self,
        page: Page,
    ) -> None:
        if not page.is_closed():
            self.last_interacted_page = page

    def _handle_close(
        self,
        closed_page: Page,
    ) -> None:
        self._registered_ids.discard(id(closed_page))
        if self.last_interacted_page == closed_page:
            pages=self.pages()
            self.last_interacted_page = pages[-1] if pages else None

    def mark_interacted(
        self,
        page: Page,
    ) -> None:
        if not page.is_closed():
            self.last_interacted_page = page
            
    def pages(self) -> list[Page]:
        return [
            page
            for page in self.context.pages
            if not page.is_closed()
        ]
    
    def get_current_page(
        self,
    ) -> Page:
        if (
            self.last_interacted_page
            and not self.last_interacted_page.is_closed()
        ):
            return self.last_interacted_page

        pages=self.pages()
        if not pages:
            raise RuntimeError(
                "No active browser page found."
            )
        
        self.last_interacted_page = pages[-1]
        return self.last_interacted_page