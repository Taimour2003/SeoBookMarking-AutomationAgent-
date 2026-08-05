from __future__ import annotations

from playwright.async_api import Page


async def detect_security_page(
    page: Page,
) -> str | None:
    if page.is_closed():
        return None

    try:
        title = (
            await page.title()
        ).strip().lower()

        body_text = (
            await page.locator(
                "body"
            ).inner_text(
                timeout=3_000
            )
        ).lower()

    except Exception:
        return None

    cloudflare_signals = (
        "performing security verification",
        "verify you are human",
        "checking your browser",
        "security service to protect against malicious bots",
    )

    captcha_signals = (
        "i'm not a robot",
        "captcha",
        "complete the security check",
    )

    login_signals = (
        "couldn't sign you in",
        "this browser or app may not be secure",
    )

    if (
        "just a moment" in title
        or any(
            signal in body_text
            for signal in cloudflare_signals
        )
    ):
        return "CLOUDFLARE_REQUIRED"

    if any(
        signal in body_text
        for signal in captcha_signals
    ):
        return "CAPTCHA_REQUIRED"

    if any(
        signal in body_text
        for signal in login_signals
    ):
        return "MANUAL_LOGIN_REQUIRED"

    return None