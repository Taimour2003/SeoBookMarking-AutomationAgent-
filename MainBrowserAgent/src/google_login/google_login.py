from playwright.async_api import Page


GOOGLE_SIGNIN_URL = (
    "https://accounts.google.com/v3/signin/identifier"
    "?continue=https://www.google.com/"
)


async def login_google(
    page: Page,
    email: str,
    password: str,
) -> bool:

    print("[GOOGLE LOGIN] Opening Google login...")

    await page.goto(
        GOOGLE_SIGNIN_URL,
        wait_until="domcontentloaded",
        timeout=30_000,
    )

    # ==========================
    # EMAIL
    # ==========================

    email_field = page.locator(
        "#identifierId"
    )

    await email_field.wait_for(
        state="visible",
        timeout=15_000,
    )

    await email_field.fill(email)

    print("[GOOGLE LOGIN] Email entered.")

    # ==========================
    # EMAIL NEXT
    # ==========================

    next_button = page.get_by_role(
        "button",
        name="Next",
    )

    await next_button.click()

    # ==========================
    # PASSWORD
    # ==========================

    password_field = page.locator(
        'input[name="Passwd"]'
    )

    await password_field.wait_for(
        state="visible",
        timeout=20_000,
    )

    await password_field.fill(password)

    print("[GOOGLE LOGIN] Password entered.")

    # ==========================
    # PASSWORD NEXT
    # ==========================

    password_next = page.get_by_role(
        "button",
        name="Next",
    )

    await password_next.click()

    # Give Google time to process login
    try:
        await page.wait_for_load_state(
            "domcontentloaded",
            timeout=20_000,
        )
    except Exception:
        pass

    # ==========================
    # OPTIONAL CONTINUE
    # ==========================

    continue_button = page.get_by_role(
        "button",
        name="Continue",
    )

    if await continue_button.count() > 0:

        try:
            if await continue_button.first.is_visible():
                print(
                    "[GOOGLE LOGIN] "
                    "Continue button detected."
                )

                await continue_button.first.click()

        except Exception:
            pass

    # ==========================
    # SECURITY / MFA CHECK
    # ==========================

    body_text = (
        await page.locator("body").inner_text()
    ).lower()

    security_signals = (
        "2-step verification",
        "verify it's you",
        "verify your identity",
        "check your phone",
        "enter the code",
        "security key",
        "confirm it’s you",
        "confirm it's you",
    )

    if any(
        signal in body_text
        for signal in security_signals
    ):
        print(
            "[GOOGLE LOGIN] "
            "Manual verification required."
        )

        return False

    print(
        "[GOOGLE LOGIN] "
        "Google login flow completed."
    )

    return True