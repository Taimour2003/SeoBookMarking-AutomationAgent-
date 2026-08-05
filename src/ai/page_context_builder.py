from bs4 import BeautifulSoup
from playwright.async_api import Page


async def build_ai_page_context(
    page: Page,
    errors: list[str],
    mappings: list[dict],
    current_data: dict,
) -> dict:
    form = page.locator("form")

    raw_html = (
        await form.first.inner_html()
        if await form.count() > 0
        else await page.content()
    )

    soup = BeautifulSoup(
        raw_html,
        "html.parser",
    )

    for tag in soup(
        [
            "script",
            "style",
            "iframe",
            "svg",
            "img",
            "footer",
            "nav",
        ]
    ):
        tag.decompose()

    allowed_tags = {
        "input",
        "textarea",
        "select",
        "option",
        "label",
        "button",
        "form",
        "div",
        "span",
        "p",
    }

    allowed_attributes = {
        "id",
        "name",
        "type",
        "placeholder",
        "class",
        "required",
        "readonly",
        "disabled",
        "minlength",
        "maxlength",
        "pattern",
        "aria-label",
        "role",
        "value",
    }

    compressed_parts = []

    for element in soup.find_all(
        list(allowed_tags)
    ):
        attributes = {
            key: value
            for key, value
            in element.attrs.items()
            if key in allowed_attributes
        }

        text = element.get_text(
            " ",
            strip=True,
        )[:150]

        compressed_parts.append(
            {
                "tag": element.name,
                "attributes": attributes,
                "text": text,
            }
        )

    return {
        "page_url": page.url,
        "visible_errors": errors,
        "current_data": current_data,
        "field_mappings": mappings,
        "interactive_html": compressed_parts,
    }