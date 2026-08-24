from playwright.async_api import Page


async def inspect_fields(
    page: Page,
) -> list[dict]:
    raw_fields = await page.locator(
        "input, textarea, select"
    ).evaluate_all(
        """
        (elements) => elements.map((element, index) => {
            const id = element.id || "";

            const explicitLabel = id
                ? document.querySelector(
                    `label[for="${CSS.escape(id)}"]`
                )
                : null;

            const wrappingLabel =
                element.closest("label");

            const ariaLabel =
                element.getAttribute("aria-label")
                || "";

            const labelledBy =
                element.getAttribute(
                    "aria-labelledby"
                );

            const labelledElement = labelledBy
                ? document.getElementById(
                    labelledBy
                )
                : null;

            const label = (
                explicitLabel?.innerText
                || wrappingLabel?.innerText
                || labelledElement?.innerText
                || ariaLabel
                || ""
            ).trim();

            const style =
                window.getComputedStyle(element);

            const rect =
                element.getBoundingClientRect();

            const visible =
                style.display !== "none"
                && style.visibility !== "hidden"
                && rect.width > 0
                && rect.height > 0;

            return {
                index,
                tagName:
                    element.tagName.toLowerCase(),
                inputType:
                    (
                        element.getAttribute("type")
                        || ""
                    ).toLowerCase(),
                name:
                    element.getAttribute("name")
                    || "",
                elementId: id,
                label,
                placeholder:
                    element.getAttribute(
                        "placeholder"
                    ) || "",
                required:
                    element.required === true,
                visible,
                options:
                    element.tagName.toLowerCase()
                    === "select"
                        ? Array.from(
                            element.options
                        ).map(option => ({
                            label:
                                option.text.trim(),
                            value:
                                option.value
                        }))
                        : []
            };
        })
        """
    )

    fields = []

    for field in raw_fields:
        if not field["visible"]:
            continue

        if field["elementId"]:
            selector = (
                f'#{field["elementId"]}'
            )

        elif field["name"]:
            selector = (
                f'{field["tagName"]}'
                f'[name="{field["name"]}"]'
            )

        else:
            selector = (
                f'{field["tagName"]}:nth-of-type('
                f'{field["index"] + 1})'
            )

        field["selector"] = selector
        fields.append(field)

    return fields