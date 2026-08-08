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

    captcha_selectors = (
        'iframe[src*="recaptcha"]',
        'iframe[src*="hcaptcha"]',
        'iframe[src*="turnstile"]',
        '.g-recaptcha',
        '.h-captcha',
        '[data-sitekey]',
        'input[name*="captcha" i]',
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
        for signal in login_signals
    ):
        return "MANUAL_LOGIN_REQUIRED"

    for selector in captcha_selectors:
        try:
            locator = page.locator(selector)
            if await locator.count() and await locator.is_visible():
                return "CAPTCHA_REQUIRED"
        except Exception:
            continue
    
    captcha_text_signals = (
        "i 'm not a robot",
        "i am human",
        "please verify you are a human",
        "please complete the security check to access",
    )

    if any(
        signal in body_text
        for signal in captcha_text_signals
    ):
        return "CAPTCHA_REQUIRED"
    return None