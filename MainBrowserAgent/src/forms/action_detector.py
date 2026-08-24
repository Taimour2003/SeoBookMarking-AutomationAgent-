from __future__ import annotations

import re

from playwright.async_api import Locator, Page


POSITIVE_PATTERNS = (
    r"^submit$",
    r"submit\s+(bookmark|story|site|link|article|url|post)",
    r"submit\s+new",
    r"save\s+(and|&)\s+submit",
    r"save\s+changes?\s+(and|&)\s+submit",
    r"add\s+(bookmark|story|site|link|webmark)",
    r"publish",
    r"post\s+(story|link|article)",
    r"create\s+(bookmark|story|post)",
    r"finish",
    r"complete\s+submission",
)

NEXT_STEP_PATTERNS = (
    r"^continue$",
    r"^next$",
    r"continue\s+to",
    r"proceed",
    r"preview",
)

NEGATIVE_PATTERNS = (
    r"log\s*in",
    r"sign\s*in",
    r"sign\s*up",
    r"register",
    r"search",
    r"cancel",
    r"delete",
    r"remove",
    r"logout",
    r"subscribe",
    r"forgot",
    r"reset",
    r"download",
    r"upload",
    r"back",
    r"previous",
)


def _matches(
    text: str,
    patterns: tuple[str, ...],
) -> bool:
    text = text.strip().lower()

    return any(
        re.search(
            pattern,
            text,
            re.IGNORECASE,
        )
        for pattern in patterns
    )


async def _candidate_text(
    locator: Locator,
) -> str:
    parts = []

    try:
        text = (await locator.inner_text()).strip()

        if text:
            parts.append(text)
    except Exception:
        pass

    for attribute in (
        "value",
        "aria-label",
        "title",
        "name",
        "id",
    ):
        try:
            value = await locator.get_attribute(attribute)

            if value:
                parts.append(value)
        except Exception:
            pass

    return " ".join(parts).strip()


async def _is_usable(
    locator: Locator,
) -> bool:
    try:
        if not await locator.is_visible():
            return False

        if not await locator.is_enabled():
            return False

        return True

    except Exception:
        return False


async def _score_candidate(
    locator: Locator,
    *,
    inside_form: bool,
) -> tuple[int, str]:

    text = await _candidate_text(locator)

    normalized = text.lower()

    score = 0

    if inside_form:
        score += 30

    try:
        element_type = (await locator.get_attribute("type") or "").lower()
    except Exception:
        element_type = ""

    if element_type == "submit":
        score += 100

    if _matches(
        normalized,
        POSITIVE_PATTERNS,
    ):
        score += 80

    if _matches(
        normalized,
        NEXT_STEP_PATTERNS,
    ):
        score += 25

    if _matches(
        normalized,
        NEGATIVE_PATTERNS,
    ):
        score -= 150

    return score, text


async def _collect_candidates(
    page: Page,
) -> list[dict]:

    candidates = []

    # Native and common custom submit controls.
    selectors = (
        'form button[type="submit"]',
        'form input[type="submit"]',
        'form input[type="image"]',
        "form button:not([type])",
        'form [role="button"]',
        'button[type="submit"]',
        'input[type="submit"]',
        'input[type="image"]',
        "button:not([type])",
        '[role="button"]',
        "a.btn",
        "a.button",
    )

    seen = set()

    for selector in selectors:
        locator_group = page.locator(selector)

        try:
            count = await locator_group.count()
        except Exception:
            continue

        # Prevent pathological pages from
        # producing thousands of candidates.
        count = min(count, 100)

        for index in range(count):
            locator = locator_group.nth(index)

            if not await _is_usable(locator):
                continue

            try:
                identity = await locator.evaluate(
                    """
                    el => {
                        if (!el.dataset.webAgentCandidateId) {
                            el.dataset.webAgentCandidateId =
                                Math.random()
                                .toString(36)
                                .slice(2);
                        }

                        return el.dataset.webAgentCandidateId;
                    }
                    """
                )
            except Exception:
                continue

            if identity in seen:
                continue

            seen.add(identity)

            try:
                inside_form = await locator.evaluate("el => !!el.closest('form')")
            except Exception:
                inside_form = False

            score, text = await _score_candidate(
                locator,
                inside_form=inside_form,
            )

            candidates.append(
                {
                    "locator": locator,
                    "score": score,
                    "text": text,
                    "inside_form": inside_form,
                }
            )

    return candidates


async def find_submit_button(
    page: Page,
) -> Locator | None:

    candidates = await _collect_candidates(page)

    if not candidates:
        return None

    candidates.sort(
        key=lambda item: item["score"],
        reverse=True,
    )

    best = candidates[0]

    print(
        "Best submit candidate:",
        {
            "text": best["text"],
            "score": best["score"],
            "inside_form": best["inside_form"],
        },
    )

    # Don't click an ambiguous candidate.
    if best["score"] < 70:
        return None

    return best["locator"]
