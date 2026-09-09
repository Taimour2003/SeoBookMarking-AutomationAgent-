from playwright.async_api import Page


GOOGLE_SIGNIN_URL = "https://accounts.google.com/v3/signin/identifier?continue=https://www.google.com/&ec=futura_exp_og_so_72776762_e&hl=en&passive=true&flowName=GlifWebSignIn&flowEntry=ServiceLogin&dsh=S51450391:1788942662263006"


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

    print(
        "[GOOGLE LOGIN] Current URL:",
        page.url,
    )

    # # -------------------------------------------------
    # # Already logged in?
    # # -------------------------------------------------

    if "google.com" in page.url and "accounts.google.com" not in page.url:
        print("[GOOGLE LOGIN] User may already be logged in.")
        return True

    # # -------------------------------------------------
    # # Security / unusual page check
    # # -------------------------------------------------

    body_text = ""

    try:
        body_text = (await page.locator("body").inner_text(timeout=5000)).lower()
    except Exception:
        pass

    security_signals = (
        "verify it's you",
        "verify your identity",
        "2-step verification",
        "check your phone",
        "security key",
        "captcha",
        "try another way",
        "confirm it's you",
        "confirm it’s you",
    )

    if any(signal in body_text for signal in security_signals):
        print("[GOOGLE LOGIN] Manual verification required1111.")
        return False

    # -------------------------------------------------
    # Find email field using multiple selectors
    # -------------------------------------------------

    email_candidates = [
        page.locator("#identifierId"),
        page.locator('input[name="identifier"]'),
        page.get_by_label("Email or phone"),
    ]

    email_field = None

    for candidate in email_candidates:
        try:
            if await candidate.count() > 0:
                if await candidate.first.is_visible():
                    email_field = candidate.first
                    break
        except Exception:
            continue

    if email_field is None:
        print("[GOOGLE LOGIN] Email field not found.")
        print(
            "[GOOGLE LOGIN] Current URL:",
            page.url,
        )
        print(
            "[GOOGLE LOGIN] Page title:",
            await page.title(),
        )

        return False

    await email_field.fill(email)

    print("[GOOGLE LOGIN] Email entered.")

    # -------------------------------------------------
    # Click Next
    # -------------------------------------------------

    next_button = page.get_by_role(
        "button",
        name="Next",
    )

    try:
        await next_button.first.wait_for(
            state="visible",
            timeout=10_000,
        )

        await next_button.first.click()

    except Exception as error:
        print(
            "[GOOGLE LOGIN] Email Next button failed:",
            error,
        )
        return False

    # -------------------------------------------------
    # Wait for password OR security challenge
    # -------------------------------------------------

    try:
        await page.wait_for_timeout(10000)

        body_text = (await page.locator("body").inner_text()).lower()

        print("[GOOGLE LOGIN] Body text after email submission:", body_text)

        # if any(signal in body_text for signal in security_signals):
        #     print("[GOOGLE LOGIN] Manual verification appeared111.")
        #     return False

    except Exception:
        pass


    password_candidates = [
        page.locator('input[name="Passwd"]'),
        page.locator('input[type="password"]'),
        page.get_by_label("enter your password"),
    ]

    password_field = None

    for candidate in password_candidates:
        try:
            if await candidate.count() > 0:
                if await candidate.first.is_visible():
                    password_field = candidate.first
                    break
        except Exception:
            continue

    if password_field is None:
        print("[GOOGLE LOGIN] Password field not found.")
        print(
            "[GOOGLE LOGIN] Current URL:",
            page.url,
        )

        return False

    await password_field.fill(password)

    print("[GOOGLE LOGIN] Password entered.")

    # -------------------------------------------------
    # Password Next
    # -------------------------------------------------

    next_button = page.get_by_role(
        "button",
        name="Next",
    )

    try:
        await next_button.first.click(timeout=10_000)

    except Exception as error:
        print(
            "[GOOGLE LOGIN] Password Next failed:",
            error,
        )
        return False

    # -------------------------------------------------
    # Wait for result
    # -------------------------------------------------

    await page.wait_for_timeout(2000)

    body_text = (await page.locator("body").inner_text()).lower()

    if any(signal in body_text for signal in security_signals):
        print("[GOOGLE LOGIN] Manual verification required.")
        return False

    # -------------------------------------------------
    # Optional Continue
    # -------------------------------------------------

    continue_button = page.get_by_role(
        "button",
        name="Continue",
    )

    try:
        if await continue_button.count() > 0:
            if await continue_button.first.is_visible():
                await continue_button.first.click()
    except Exception:
        pass

    print("[GOOGLE LOGIN] Login flow completed.")

    return True
