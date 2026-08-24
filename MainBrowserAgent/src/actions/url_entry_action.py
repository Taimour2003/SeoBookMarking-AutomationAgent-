from __future__ import annotations

from playwright.async_api import Page

from forms.classifier import classify_field
from forms.inspector import inspect_fields


MIN_URL_CONFIDENCE = 80

def normalize_url(value: str) -> str:
    return value.strip().rstrip("/")

async def enter_current_url(
    page: Page,
    url: str,
) -> dict:
    if not url:
        return {
            "success": False,
            "status": "URL_MISSING",
            "message": "Current data does not contain a URL.",
        }
    print("Entering current URL:", url)

    fields = await inspect_fields(page)

    candidates = []

    for field in fields:
        logical_field, confidence = classify_field(
            field
        )

        if logical_field != "website_url":
            continue

        candidates.append(
            {
                "field": field,
                "confidence": confidence,
            }
        )

    if not candidates:
        return {
            "success": False,
            "status": "URL_FIELD_NOT_FOUND",
            "message": (
                "Could not safely identify a URL field "
                "on the current page."
            ),
        }

    # Highest confidence first.
    candidates.sort(
        key=lambda item: item["confidence"],
        reverse=True,
    )

    best_candidate = candidates[0]

    confidence = best_candidate[
        "confidence"
    ]

    field = best_candidate["field"]

    if confidence < MIN_URL_CONFIDENCE:
        return {
            "success": False,
            "status": "URL_FIELD_AMBIGUOUS",
            "message": (
                "A possible URL field was found, "
                "but confidence is too low."
            ),
            "confidence": confidence,
        }

    selector = field.get("selector")

    if not selector:
        return {
            "success": False,
            "status": "URL_SELECTOR_MISSING",
            "message": (
                "URL field was identified but "
                "has no usable selector."
            ),
        }

    locator = page.locator(
        selector
    ).first

    if await locator.count() == 0:
        return {
            "success": False,
            "status": "URL_FIELD_NOT_FOUND",
            "message": (
                "Detected URL field no longer exists."
            ),
        }

    # Never type into hidden fields.
    if not await locator.is_visible():
        return {
            "success": False,
            "status": "URL_FIELD_NOT_VISIBLE",
            "message": (
                "Detected URL field is not visible."
            ),
        }

    tag_name = await locator.evaluate(
        "(element) => element.tagName.toLowerCase()"
    )

    input_type = (
        await locator.get_attribute("type")
        or ""
    ).lower()

    # Extra protection against accidentally
    # typing into unsafe/unrelated fields.
    if input_type in {
        "password",
        "email",
        "search",
        "checkbox",
        "radio",
        "file",
        "hidden",
    }:
        return {
            "success": False,
            "status": "UNSAFE_URL_FIELD",
            "message": (
                f"Detected field type '{input_type}' "
                "is not safe for URL insertion."
            ),
        }

    readonly = await locator.get_attribute(
        "readonly"
    )

    disabled = await locator.is_disabled()

    if readonly is not None:
        current_value = ""

        try:
            current_value = (
                await locator.input_value()
            )
        except Exception:
            pass

        return {
            "success": False,
            "status": "URL_FIELD_READONLY",
            "message": (
                "URL field is readonly and cannot "
                "be changed automatically."
            ),
            "current_value": current_value,
        }

    if disabled:
        return {
            "success": False,
            "status": "URL_FIELD_DISABLED",
            "message": (
                "URL field is currently disabled."
            ),
        }

    try:
        await locator.scroll_into_view_if_needed()

        await locator.focus()

        if tag_name in {
            "input",
            "textarea",
        }:
            await locator.fill(url)

        else:
            return {
                "success": False,
                "status": "UNSUPPORTED_URL_FIELD",
                "message": (
                    f"Detected URL element '{tag_name}' "
                    "cannot safely be filled."
                ),
            }

    except Exception as error:
        return {
            "success": False,
            "status": "URL_ENTRY_FAILED",
            "message": (
                "URL field was detected, but filling failed."
            ),
            "error": str(error),
        }

    # Verify the entered value.
    try:
        actual_value = await locator.input_value()
    except Exception:
        actual_value = ""

    if normalize_url(actual_value) != normalize_url(url):
        return {
            "success": False,
            "status": "URL_ENTRY_UNVERIFIED",
            "message": (
                "URL insertion was attempted but "
                "the final field value could not be verified."
            ),
            "expected": url,
            "actual": actual_value,
        }

    return {
        "success": True,
        "status": "URL_ENTERED",
        "message": "URL entered successfully.",
        "selector": selector,
        "confidence": confidence,
        "url": url,
    }