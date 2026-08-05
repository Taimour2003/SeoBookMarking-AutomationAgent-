import re

from playwright.async_api import Page


SUBMIT_PATTERN = re.compile(
    r"submit|publish|post|save|"
    r"add\s*bookmark|create|continue",
    re.IGNORECASE,
)

BLOCKED_PATTERN = re.compile(
    r"delete|remove|cancel|pay|"
    r"purchase|upgrade|deactivate",
    re.IGNORECASE,
)


async def find_submit_button(
    page: Page,
):
    candidates = page.get_by_role(
        "button",
        name=SUBMIT_PATTERN,
        exact=False,
    )

    count = await candidates.count()

    valid_candidates = []

    for index in range(count):
        candidate = candidates.nth(index)

        if not await candidate.is_visible():
            continue

        text = (
            await candidate.inner_text()
        ).strip()

        if BLOCKED_PATTERN.search(text):
            continue

        valid_candidates.append(
            candidate
        )

    if len(valid_candidates) == 1:
        return valid_candidates[0]

    submit_inputs = page.locator(
        'input[type="submit"]'
    )

    if await submit_inputs.count() == 1:
        return submit_inputs.first

    return None