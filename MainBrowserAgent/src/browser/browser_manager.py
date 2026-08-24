from __future__ import annotations

from pathlib import Path

from playwright.async_api import (
    Browser,
    BrowserContext,
    Page,
    Playwright,
)


class BrowserManager:
    def __init__(
        self,
        settings,
    ):
        self.settings = settings

        self.browser: Browser | None = None
        self.context: BrowserContext | None = None
        self.page: Page | None = None
        self._owns_context=False

        # self.is_cdp_connection = False

    async def start(
        self,
        playwright: Playwright,
    ) -> Page:

        if self.settings.browser_mode == "cdp":
            return await self._connect_over_cdp(playwright)

        if self.settings.browser_mode == "playwright":
            return await self._launch_playwright_browser(playwright)

        raise ValueError(f"Unsupported browser mode: {self.settings.browser_mode}")
    
    async def _connect_over_cdp(self,playwright: Playwright) -> Page:
        # cdp_url = getattr(
        #     self.settings,
        #     "cdp_url",
        #     "http://localhost:9222",
        # )

        try:
            self.browser = await playwright.chromium.connect_over_cdp(self.settings.cdp_url)
        except Exception as error:
            raise RuntimeError(
                "Existing Chrome se connect nahi ho saka. "
                "Pehle Chrome remote-debugging mode mein "
                "launch karein.\n"
                f"CDP URL: {self.settings.cdp_url}\n"
                f"Original error: {error}"
            ) from error

        if not self.browser.contexts:
            raise RuntimeError(
                "Chrome connected hai, lekin browser context available nahi."
            )

        self.context = self.browser.contexts[0]
        self._owns_context = False

        self._configure_context()
        
        pages=self.open_pages()
        self.page=pages[-1]
        print(
            "WebAgent existing Chrome se connected:",
            self.page.url,
        )

        return self.page    

    async def _launch_playwright_context(self,playwright: Playwright) -> Page:
        self.context = await playwright.chromium.launch_persistent_context(
            user_data_dir=str(self.settings.browser_profile_dir),   
            channel=self.settings.browser_channel,
            headless=self.settings.headless,
            no_viewport=True,
            ignore_https_errors=self.settings.ignore_https_errors,
            slow_mo=self.settings.slow_mo,
            args=[
                "--start-maximized",
            ],
        )
        
        self._owns_context = True
        self._configure_context()
        
        pages=self.open_pages()
        self.page=pages[0] if pages else await self.context.new_page()
        
        print(
            "Playwright Chrome started:",
            self.page.url,
        )
        return self.page
        
    def _configure_context(self) -> None:
        if not self.context:
            raise RuntimeError("Browser context is not available.")

        self.context.set_default_timeout(self.settings.default_timeout)
        self.context.set_default_navigation_timeout(self.settings.navigation_timeout)
        
    def open_pages(self) -> list[Page]:
        if not self.context:
            raise RuntimeError("Browser context is not available.")
        return [page for page in self.context.pages if not page.is_closed()]
    
    async def new_page(self) -> list[Page]:
        if not self.context:
            raise RuntimeError("Browser context is not started.")

        self.page = await self.context.new_page()

        return self.page
    
    async def _connect_to_existing_chrome(
        self,
        playwright: Playwright,
    ) -> Page:
        cdp_url = getattr(
            self.settings,
            "cdp_url",
            "http://localhost:9222",
        )

        try:
            self.browser = await playwright.chromium.connect_over_cdp(cdp_url)
        except Exception as error:
            raise RuntimeError(
                "Existing Chrome se connect nahi ho saka. "
                "Pehle Chrome remote-debugging mode mein "
                "launch karein.\n"
                f"CDP URL: {cdp_url}\n"
                f"Original error: {error}"
            ) from error

        if not self.browser.contexts:
            raise RuntimeError(
                "Chrome connected hai, lekin browser context available nahi."
            )

        self.context = self.browser.contexts[0]
        self.is_cdp_connection = True

        self._configure_context()

        if self.context.pages:
            self.page = self.context.pages[-1]
        else:
            self.page = await self.context.new_page()

        print(
            "WebAgent existing Chrome se connected:",
            self.page.url,
        )

        return self.page

    async def _launch_playwright_browser(
        self,
        playwright: Playwright,
    ) -> Page:
        profile_path = Path(
            getattr(
                self.settings,
                "browser_profile_dir",
                "data/browser_profiles/web_agent",
            )
        )

        profile_path.mkdir(
            parents=True,
            exist_ok=True,
        )

        self.context = await playwright.chromium.launch_persistent_context(
            user_data_dir=str(profile_path),
            channel=getattr(
                self.settings,
                "browser_channel",
                "chrome",
            ),
            headless=getattr(
                self.settings,
                "headless",
                False,
            ),
            no_viewport=True,
            ignore_https_errors=getattr(
                self.settings,
                "ignore_https_errors",
                True,
            ),
            slow_mo=getattr(
                self.settings,
                "slow_mo",
                100,
            ),
            args=[
                "--start-maximized",
            ],
        )

        self.is_cdp_connection = False

        self._configure_context()

        if self.context.pages:
            self.page = self.context.pages[0]
        else:
            self.page = await self.context.new_page()

        print(
            "Playwright Chrome started:",
            self.page.url,
        )

        return self.page

    # def _configure_context(self) -> None:
    #     if not self.context:
    #         raise RuntimeError("Browser context is not available.")

    #     self.context.set_default_timeout(
    #         getattr(
    #             self.settings,
    #             "default_timeout",
    #             10_000,
    #         )
    #     )

    #     self.context.set_default_navigation_timeout(
    #         getattr(
    #             self.settings,
    #             "navigation_timeout",
    #             30_000,
    #         )
    #     )

    def get_latest_page(self) -> Page:
        if not self.context:
            raise RuntimeError("Browser context is not available.")

        available_pages = [page for page in self.context.pages if not page.is_closed()]

        if not available_pages:
            raise RuntimeError("No open browser tab is available.")

        self.page = available_pages[-1]

        return self.page

    # async def new_page(self) -> Page:
    #     if not self.context:
    #         raise RuntimeError("Browser context is not started.")

    #     self.page = await self.context.new_page()

    #     return self.page

    async def close(self) -> None:
        if self._owns_context and self.context:
            await self.context.close()
        
        self.page = None
        self.context = None
        self.browser = None
        self._owns_context = False
        
