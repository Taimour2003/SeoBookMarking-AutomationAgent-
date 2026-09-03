from __future__ import annotations

import asyncio
import os
import subprocess
from pathlib import Path
from urllib.parse import urlparse

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

        self._owns_context = False
        self.is_cdp_connection = False

    # =========================================================
    # PUBLIC START
    # =========================================================

    async def start(
        self,
        playwright: Playwright,
    ) -> Page:

        if self.settings.browser_mode == "cdp":
            return await self._connect_over_cdp(
                playwright
            )

        if self.settings.browser_mode == "playwright":
            return await self._launch_playwright_browser(
                playwright
            )

        raise ValueError(
            f"Unsupported browser mode: "
            f"{self.settings.browser_mode}"
        )

    # =========================================================
    # CDP MODE
    # =========================================================

    async def _connect_over_cdp(
        self,
        playwright: Playwright,
    ) -> Page:

        cdp_url = self.settings.cdp_url

        print(
            "[CDP] Checking Chrome:",
            cdp_url,
        )

        # -----------------------------------------------------
        # 1. Check whether Chrome CDP is already available
        # -----------------------------------------------------

        cdp_ready = await self._is_cdp_ready()

        # -----------------------------------------------------
        # 2. If not available, launch Chrome automatically
        # -----------------------------------------------------

        if not cdp_ready:

            print(
                "[CDP] Chrome remote debugging "
                "not detected."
            )

            print(
                "[CDP] Launching Chrome..."
            )

            await self._launch_chrome_for_cdp()

            print(
                "[CDP] Waiting for Chrome "
                "remote debugging port..."
            )

            await self._wait_for_cdp(
                timeout=15,
            )

        else:

            print(
                "[CDP] Existing Chrome CDP "
                "instance detected."
            )

        # -----------------------------------------------------
        # 3. Connect Playwright
        # -----------------------------------------------------

        try:

            self.browser = (
                await playwright.chromium.connect_over_cdp(
                    cdp_url
                )
            )

        except Exception as error:

            raise RuntimeError(
                "Chrome launch/connect attempt ke "
                "baad bhi CDP connection establish "
                "nahi ho saka.\n"
                f"CDP URL: {cdp_url}\n"
                f"Original error: {error}"
            ) from error

        # -----------------------------------------------------
        # 4. Get BrowserContext
        # -----------------------------------------------------

        if not self.browser.contexts:

            raise RuntimeError(
                "Chrome connected hai, lekin "
                "browser context available nahi."
            )

        self.context = (
            self.browser.contexts[0]
        )

        self._owns_context = False
        self.is_cdp_connection = True

        self._configure_context()

        # -----------------------------------------------------
        # 5. Get/create page
        # -----------------------------------------------------

        pages = self.open_pages()

        if pages:
            self.page = pages[-1]
        else:
            self.page = (
                await self.context.new_page()
            )

        print(
            "[CDP] WebAgent Chrome se connected:",
            self.page.url,
        )

        return self.page

    # =========================================================
    # CHECK CDP PORT
    # =========================================================

    def _get_cdp_host_port(
        self,
    ) -> tuple[str, int]:

        url = self.settings.cdp_url

        if "://" not in url:
            url = f"http://{url}"

        parsed = urlparse(url)

        host = (
            parsed.hostname
            or "127.0.0.1"
        )

        # localhost ki jagah IPv4 use karein
        if host == "localhost":
            host = "127.0.0.1"

        port = (
            parsed.port
            or 9222
        )

        return host, port

    async def _is_cdp_ready(
        self,
    ) -> bool:

        host, port = (
            self._get_cdp_host_port()
        )

        try:

            reader, writer = (
                await asyncio.wait_for(
                    asyncio.open_connection(
                        host,
                        port,
                    ),
                    timeout=1,
                )
            )

            writer.close()

            try:
                await writer.wait_closed()
            except Exception:
                pass

            return True

        except (
            OSError,
            asyncio.TimeoutError,
        ):
            return False

    # =========================================================
    # WAIT FOR CDP
    # =========================================================

    async def _wait_for_cdp(
        self,
        timeout: float = 15,
    ) -> None:

        loop = (
            asyncio.get_running_loop()
        )

        end_time = (
            loop.time()
            + timeout
        )

        while loop.time() < end_time:

            if await self._is_cdp_ready():

                print(
                    "[CDP] Chrome debugging "
                    "port is ready."
                )

                return

            await asyncio.sleep(
                0.25
            )

        host, port = (
            self._get_cdp_host_port()
        )

        raise RuntimeError(
            "Chrome launch hua lekin "
            "remote-debugging port ready "
            "nahi hua.\n"
            f"Host: {host}\n"
            f"Port: {port}"
        )

    # =========================================================
    # FIND GOOGLE CHROME
    # =========================================================

    def _find_chrome_executable(
        self,
    ) -> Path:

        candidates: list[Path] = []

        program_files = (
            os.environ.get(
                "PROGRAMFILES"
            )
        )

        program_files_x86 = (
            os.environ.get(
                "PROGRAMFILES(X86)"
            )
        )

        local_app_data = (
            os.environ.get(
                "LOCALAPPDATA"
            )
        )

        if program_files:

            candidates.append(
                Path(program_files)
                / "Google"
                / "Chrome"
                / "Application"
                / "chrome.exe"
            )

        if program_files_x86:

            candidates.append(
                Path(program_files_x86)
                / "Google"
                / "Chrome"
                / "Application"
                / "chrome.exe"
            )

        if local_app_data:

            candidates.append(
                Path(local_app_data)
                / "Google"
                / "Chrome"
                / "Application"
                / "chrome.exe"
            )

        for candidate in candidates:

            if candidate.exists():

                print(
                    "[CHROME] Found:",
                    candidate,
                )

                return candidate

        searched = "\n".join(
            str(path)
            for path in candidates
        )

        raise RuntimeError(
            "Google Chrome executable "
            "nahi mila.\n"
            "Checked paths:\n"
            f"{searched}"
        )

    # =========================================================
    # AUTO-LAUNCH CHROME FOR CDP
    # =========================================================

    async def _launch_chrome_for_cdp(
        self,
    ) -> None:

        chrome_path = (
            self._find_chrome_executable()
        )

        _, port = (
            self._get_cdp_host_port()
        )

        profile_dir = Path(
            self.settings.browser_profile_dir
        )

        profile_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

        command = [
            str(chrome_path),

            f"--remote-debugging-port={port}",

            f"--user-data-dir={profile_dir}",

            "--start-maximized",

            "--no-first-run",

            "--no-default-browser-check",
        ]

        start_url = getattr(
            self.settings,
            "start_url",
            "",
        )

        if start_url:
            command.append(
                start_url
            )

        print(
            "[CHROME] Starting CDP Chrome..."
        )

        print(
            "[CHROME] Profile:",
            profile_dir,
        )

        # DETACHED_PROCESS + CREATE_NEW_PROCESS_GROUP
        # lets Chrome continue independently.
        creation_flags = 0

        if os.name == "nt":

            creation_flags = (
                subprocess.CREATE_NEW_PROCESS_GROUP
                | subprocess.DETACHED_PROCESS
            )

        try:

            subprocess.Popen(
                command,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=creation_flags,
            )

        except Exception as error:

            raise RuntimeError(
                "Chrome automatically launch "
                "nahi ho saka.\n"
                f"Chrome: {chrome_path}\n"
                f"Error: {error}"
            ) from error

    # =========================================================
    # PLAYWRIGHT-OWNED BROWSER MODE
    # =========================================================

    async def _launch_playwright_browser(
        self,
        playwright: Playwright,
    ) -> Page:

        profile_path = Path(
            self.settings.browser_profile_dir
        )

        profile_path.mkdir(
            parents=True,
            exist_ok=True,
        )

        self.context = (
            await playwright.chromium.launch_persistent_context(
                user_data_dir=str(
                    profile_path
                ),

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
        )

        self._owns_context = True
        self.is_cdp_connection = False

        self._configure_context()

        pages = self.open_pages()

        if pages:

            self.page = pages[0]

        else:

            self.page = (
                await self.context.new_page()
            )

        print(
            "[BROWSER] Playwright Chrome started:",
            self.page.url,
        )

        return self.page

    # =========================================================
    # CONTEXT CONFIG
    # =========================================================

    def _configure_context(
        self,
    ) -> None:

        if not self.context:

            raise RuntimeError(
                "Browser context "
                "is not available."
            )

        self.context.set_default_timeout(
            self.settings.default_timeout
        )

        self.context.set_default_navigation_timeout(
            self.settings.navigation_timeout
        )

    # =========================================================
    # PAGE HELPERS
    # =========================================================

    def open_pages(
        self,
    ) -> list[Page]:

        if not self.context:

            raise RuntimeError(
                "Browser context "
                "is not available."
            )

        return [
            page
            for page in self.context.pages
            if not page.is_closed()
        ]

    async def new_page(
        self,
    ) -> Page:

        if not self.context:

            raise RuntimeError(
                "Browser context "
                "is not started."
            )

        self.page = (
            await self.context.new_page()
        )

        return self.page

    def get_latest_page(
        self,
    ) -> Page:

        if not self.context:

            raise RuntimeError(
                "Browser context "
                "is not available."
            )

        available_pages = [
            page
            for page in self.context.pages
            if not page.is_closed()
        ]

        if not available_pages:

            raise RuntimeError(
                "No open browser tab "
                "is available."
            )

        self.page = (
            available_pages[-1]
        )

        return self.page

    # =========================================================
    # CLOSE
    # =========================================================

    async def close(
        self,
    ) -> None:

        # Playwright-launched browser:
        # WebAgent owns context, so close it.

        if (
            self._owns_context
            and self.context
        ):

            await self.context.close()

        # CDP Chrome:
        # Hum context/browser ko intentionally
        # close nahi kar rahe, kyun ke actual
        # Chrome user ka persistent browser hai.

        self.page = None
        self.context = None
        self.browser = None

        self._owns_context = False
        self.is_cdp_connection = False