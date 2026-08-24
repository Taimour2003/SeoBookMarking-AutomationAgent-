from __future__ import annotations

from playwright.async_api import Page


ERROR_SELECTORS = (
    '[role="alert"]',
    ".error",
    ".errors",
    ".field-error",
    ".validation-error",
    ".invalid-feedback",
    ".help-block",
    ".text-danger",
    ".alert-danger",
    ".is-invalid",
    '[class*="error"]',
    '[class*="invalid"]',
)


async def read_form_errors(
    page: Page,
) -> list[str]:
    found_errors: list[str] = []

    for selector in ERROR_SELECTORS:
        locator = page.locator(selector)
        count = await locator.count()

        for index in range(count):
            element = locator.nth(index)

            try:
                if not await element.is_visible():
                    continue

                text = " ".join(
                    (
                        await element.inner_text()
                    ).split()
                ).strip()

                if (
                    text
                    and text not in found_errors
                ):
                    found_errors.append(text)

            except Exception:
                continue

    # Native browser validation messages
    invalid_fields = page.locator(
        "input:invalid, textarea:invalid, select:invalid"
    )

    invalid_count = await invalid_fields.count()

    for index in range(invalid_count):
        field = invalid_fields.nth(index)

        try:
            message = await field.evaluate(
                """
                element =>
                    element.validationMessage || ""
                """
            )

            message = " ".join(
                str(message).split()
            ).strip()

            if (
                message
                and message not in found_errors
            ):
                found_errors.append(message)

        except Exception:
            continue

    # Text fallback for websites whose errors
    # do not use normal error classes
    body_text = " ".join(
        (
            await page.locator("body").inner_text()
        ).split()
    ).strip()

    known_error_phrases = (
        "description must be between",
        "title must be between",
        "field is required",
        "this field is required",
        "please select a category",
        "invalid url",
        "please enter a valid url",
        "keywords are required",
        "captcha is required",
    )

    body_lower = body_text.lower()

    for phrase in known_error_phrases:
        if phrase not in body_lower:
            continue

        # Extract the nearby sentence/line.
        for line in (
            await page.locator("body").inner_text()
        ).splitlines():
            cleaned_line = " ".join(
                line.split()
            ).strip()

            if (
                phrase in cleaned_line.lower()
                and cleaned_line
                not in found_errors
            ):
                found_errors.append(
                    cleaned_line
                )

    return found_errors