from urllib.parse import urljoin, urlparse

from playwright.async_api import Page

import re

from enum import Enum


import asyncio
from playwright.async_api import async_playwright

# Top Common Signup Slugs
SIGNUP_PATTERN = re.compile(
    r"\b("
    r"sign\s*up|"
    r"signup|"
    r"register|"
    r"create\s+account|"
    r"join"
    r")\b",
    re.IGNORECASE,
)


# Keep fallback list small.
SIGNUP_PATHS = [
    "/register",
    "/signup",
    "/sign-up",
    "/join",
    "/account/register",
]


class SignupPageStatus(Enum):
    VALID = "VALID"
    SECURITY_REQUIRED = "SECURITY_REQUIRED"
    INVALID = "INVALID"


async def validate_signup_url(
    page: Page,
    candidate_url: str,
    timeout_ms: int = 10000,
) -> SignupPageStatus:

    try:
        body_text = (await page.locator("body").inner_text(timeout=timeout_ms)).lower()

        security_signals = (
            "verify you are human",
            "captcha",
            "checking your browser",
            "security verification",
            "just a moment",
            "performing security verification",
        )

        # ---------------------------------
        # Security verification is NOT
        # treated as invalid site.
        # ---------------------------------

        if any(signal in body_text for signal in security_signals):
            print(f"[SECURITY REQUIRED] {candidate_url}")

            return SignupPageStatus.SECURITY_REQUIRED

        # ---------------------------------
        # Real error pages
        # ---------------------------------

        error_signals = (
            "404 not found",
            "page not found",
            "does not exist",
            "page doesn't exist",
        )

        if any(signal in body_text for signal in error_signals):
            print(f"[INVALID PAGE] {candidate_url}")

            return SignupPageStatus.INVALID

        # ---------------------------------
        # Signup form signals
        # ---------------------------------

        password_count = await page.locator("input[type='password']").count()

        email_count = await page.locator(
            ("input[type='email'], input[name*='email' i]")
        ).count()

        signup_button_count = await page.get_by_role(
            "button",
            name=SIGNUP_PATTERN,
        ).count()

        submit_signup_count = await page.locator(
            'input[type="submit"]'
            '[value*="register" i], '
            'input[type="submit"]'
            '[value*="sign up" i]'
        ).count()

        if signup_button_count > 0 or submit_signup_count > 0:
            return SignupPageStatus.VALID

        if (
            password_count > 0
            and email_count > 0
            and SIGNUP_PATTERN.search(body_text[:5000])
        ):
            return SignupPageStatus.VALID

        return SignupPageStatus.INVALID

    except Exception as error:
        print(f"[VALIDATION ERROR] {candidate_url}: {error}")

        return SignupPageStatus.INVALID


async def find_signup_url(
    page: Page, base_url: str, timeout_ms: int = 10000
) -> str | None:
    try:
        await page.goto(base_url, wait_until="domcontentloaded", timeout=timeout_ms)

    except Exception as e:
        print(f"Error navigating to base URL {base_url}: {e}")
        return None

    possible_links = page.get_by_role("link", name=SIGNUP_PATTERN)
    print(f"Found {await possible_links.count()} possible signup links on {base_url}")

    count = min(await possible_links.count(), 10)  # Limit to first 10 links

    for i in range(count):
        link = possible_links.nth(i)

        try:
            href = await link.get_attribute("href")

            if not href:
                continue

            candidate_url = urljoin(base_url, href)

            print(f"Checking candidate signup URL: {candidate_url}")

            await page.goto(
                candidate_url, wait_until="domcontentloaded", timeout=timeout_ms
            )

            status = await validate_signup_url(page, candidate_url, timeout_ms)

            print(f"Validation status for {candidate_url}: {status}")

            if status == SignupPageStatus.VALID:
                print(f"[SIGNUP FOUND] {page.url}")

                return page.url

            if status == SignupPageStatus.SECURITY_REQUIRED:
                print(
                    "[SIGNUP POSSIBLE] "
                    "Security verification detected. "
                    "Leaving tab open for user."
                )

                return page.url

            await page.goto(base_url, wait_until="domcontentloaded", timeout=timeout_ms)

        except Exception as e:
            print(f"Error checking candidate URL {candidate_url}: {e}")
            continue

    parsed = urlparse(base_url)

    origin = f"{parsed.scheme}://{parsed.netloc}"

    for path in SIGNUP_PATHS:
        candidate = urljoin(
            origin,
            path,
        )
        print(f"Checking fallback signup URL: {candidate}")

        try:
            response = await page.goto(
                candidate,
                wait_until="domcontentloaded",
                timeout=timeout_ms,
            )

            # IMPORTANT:
            # Pehle page validate karo.
            # Cloudflare 403 return kar sakta hai,
            # lekin page valid site ka security challenge ho sakta hai.
            status = await validate_signup_url(
                page,
                candidate,
                timeout_ms,
            )

            print(f"Validation status for fallback {candidate}: {status}")

            if status == SignupPageStatus.SECURITY_REQUIRED:
                print(
                    "[SECURITY REQUIRED] Leaving this page open:",
                    page.url,
                )

                return page.url

            if status == SignupPageStatus.VALID:
                print(
                    "[SIGNUP FOUND FALLBACK]",
                    page.url,
                )

                return page.url

            # Ab HTTP error reject karna safe hai.
            if response and response.status >= 400:
                print(f"[HTTP {response.status}] Invalid fallback: {candidate}")

                continue

        except Exception as error:
            print(f"[FALLBACK ERROR] {candidate}: {error}")

            continue

    print(f"[NO SIGNUP FOUND] Returning tab to base URL: {base_url}")
    try:
        await page.goto(base_url, wait_until="domcontentloaded", timeout=timeout_ms)
    except Exception as e:
        print(f"Error returning to base URL: {e}")

    return None


# Tasveer image_96dda2.png se extract kiye gaye sample URLs
TEST_URLS = [
    "https://99bookmarking.com/",
    #     "https://a2zbookmarking.com",
    #     "https://a2zbookmarks.com",
    #     "https://activebookmarks.com",
    #     "https://admyurl.com",
    #     "https://atavi.com",
]


async def run_tests():
    print("🚀 Starting Signup Link Detection Test...")

    # Playwright start karein
    async with async_playwright() as p:
        # headless=False rakha hai taaki aapko screen par browser kaam karta nazar aaye
        browser = await p.chromium.launch(headless=False, slow_mo=20000)
        context = await browser.new_context()
        page = await context.new_page()

        success_count = 0
        failed_urls = []

        print("\n--- Processing URLs ---")
        for url in TEST_URLS:
            print(f"\nTarget: {url}")

            # Aapka function call kar rahe hain
            result = await find_signup_url(page, url, timeout_ms=15000)

            if result:
                print(f"✅ SUCCESS: Form found at -> {result}")
                success_count += 1
            else:
                print(f"❌ FAILED: Could not find signup page.")
                failed_urls.append(url)

        # Cleanup
        await page.close()
        await context.close()
        await browser.close()

        # Final Summary
        print("\n--- Test Summary ---")
        print(f"Total URLs Tested: {len(TEST_URLS)}")
        print(f"Successfully Found: {success_count}")
        print(f"Failed to Find: {len(failed_urls)}")
        if failed_urls:
            print("Failed URLs List:")
            for f_url in failed_urls:
                print(f" - {f_url}")


# Script ko run karne ke liye entry point
if __name__ == "__main__":
    # Jupyter ya existing loop mein masla aaye toh nest_asyncio use karein,
    # warna standard python script ke liye ye theek hai:
    asyncio.run(run_tests())
