from urllib.parse import urljoin

from playwright.async_api import Page

# Top Common Signup Slugs
SIGNUP_PATHS = [
    "/register",
    "/signup",
    "/register.php",
    "/signup.php",
    "/join",
    "/sign-up",
    "/user/register",
    "/account/register",
    "/join.php",
    "/user_register.php",
]

async def is_valid_signup_page(page: Page, target_url: str) -> bool:
    """Check karta hai ke kya page sach mein ek valid signup page hai."""
    try:
        # 1. URL Redirect Check (Agar homepage par redirect ho gaya to invalid)
        if page.url.rstrip("/") == target_url.rsplit("/", 1)[0].rstrip("/"):
            return False

        # 2. Page Text Check for 404 Errors
        content = (await page.content()).lower()
        if "404 not found" in content or "page not found" in content or "does not exist" in content:
            return False

        # 3. Form Input Check (Signup form mein Password/Email input hota hai)
        has_password_field = await page.locator("input[type='password']").count() > 0
        has_email_field = await page.locator("input[type='email'], input[name*='email']").count() > 0
        
        # Agar password ya email input mil jaye toh confirm signup page hai
        if has_password_field or has_email_field:
            return True

        # Secondary Check: Button Text (Register / Sign Up)
        has_signup_btn = await page.locator("button, input[type='submit']", has_text=r"/(register|sign\s*up|join)/i").count() > 0
        if has_signup_btn:
            return True

    except Exception:
        pass
        
    return False


async def find_signup_url(page: Page, base_url: str) -> str | None:
    """Base URL par tamam common paths try karta hai."""
    # Ensure base_url ends correctly
    base_url = base_url.rstrip("/")

    for path in SIGNUP_PATHS:
        target_url = urljoin(base_url, path)
        try:
            # Kam timeout rakhein taaki jaldi try ho sakay
            response = await page.goto(target_url, wait_until="commit", timeout=6000)
            
            if response and response.status == 200:
                if await is_valid_signup_page(page, target_url):
                    print(f"[FOUND] Signup Page: {page.url}")
                    return page.url
        except Exception:
            continue

    print(f"[FAILED] No signup page found for {base_url}")
    return None