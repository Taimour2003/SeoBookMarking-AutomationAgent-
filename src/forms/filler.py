from playwright.async_api import Page


CATEGORY_ALIASES = (
    "Business",
    "Business Services",
    "General Business",
    "Companies",
    "Entrepreneurship",
)


async def select_category(
    locator,
    desired_value: str,
) -> bool:
    options = await locator.locator(
        "option"
    ).evaluate_all(
        """
        options => options.map(option => ({
            label: option.text.trim(),
            value: option.value
        }))
        """
    )

    preferred_values = (
        desired_value,
        *CATEGORY_ALIASES,
    )

    for preferred in preferred_values:
        for option in options:
            if (
                preferred.lower()
                == option["label"].lower()
            ):
                await locator.select_option(
                    value=option["value"]
                )
                return True

    for preferred in preferred_values:
        for option in options:
            if (
                preferred.lower()
                in option["label"].lower()
            ):
                await locator.select_option(
                    value=option["value"]
                )
                return True

    return False


# async def fill_fields(
#     page: Page,
#     mappings: list[dict],
#     data: dict,
# ) -> list[str]:
#     filled_fields = []

#     for mapping in mappings:
#         logical_field = mapping[
#             "logical_field"
#         ]

#         value = data.get(logical_field)

#         if logical_field == "category":
#             value = value or "Business"

#         if value in (None, "", []):
#             continue

#         locator = page.locator(
#             mapping["selector"]
#         ).first

#         tag_name = await locator.evaluate(
#             "(element) => "
#             "element.tagName.toLowerCase()"
#         )

#         input_type = (
#             await locator.get_attribute("type")
#             or ""
#         ).lower()

#         if tag_name == "select":
#             selected = await select_category(
#                 locator,
#                 str(value),
#             )

#             if selected:
#                 filled_fields.append(
#                     logical_field
#                 )

#         elif input_type in {
#             "checkbox",
#             "radio",
#         }:
#             if bool(value):
#                 await locator.check()
#                 filled_fields.append(
#                     logical_field
#                 )

#         else:
#             if isinstance(value, list):
#                 value = ", ".join(
#                     str(item)
#                     for item in value
#                 )

#             await locator.fill(
#                 str(value)
#             )

#             filled_fields.append(
#                 logical_field
#             )

#     return filled_fields

async def fill_fields(
    page: Page,
    mappings: list[dict],
    data: dict,
) -> dict:
    filled_fields = []
    skipped_fields = []
    failed_fields = []

    for mapping in mappings:
        logical_field = mapping[
            "logical_field"
        ]

        value = data.get(logical_field)

        if logical_field == "category":
            value = value or "Business"

        if value in (None, "", []):
            skipped_fields.append(
                {
                    "field": logical_field,
                    "reason": "No value provided",
                }
            )
            continue

        locator = page.locator(
            mapping["selector"]
        ).first

        try:
            if await locator.count() == 0:
                failed_fields.append(
                    {
                        "field": logical_field,
                        "reason":
                            "Selector not found",
                        "selector":
                            mapping["selector"],
                    }
                )
                continue

            is_visible = await locator.is_visible()

            if not is_visible:
                skipped_fields.append(
                    {
                        "field": logical_field,
                        "reason":
                            "Field is not visible",
                    }
                )
                continue

            is_disabled = await locator.is_disabled()

            readonly = await locator.get_attribute(
                "readonly"
            )

            if is_disabled:
                skipped_fields.append(
                    {
                        "field": logical_field,
                        "reason":
                            "Field is disabled",
                    }
                )
                continue

            if readonly is not None:
                current_value = (
                    await locator.input_value()
                )

                skipped_fields.append(
                    {
                        "field": logical_field,
                        "reason":
                            "Field is readonly",
                        "current_value":
                            current_value,
                    }
                )

                print(
                    f"Skipping readonly field "
                    f"{logical_field}. "
                    f"Current value: "
                    f"{current_value}"
                )

                continue

            tag_name = await locator.evaluate(
                """
                element =>
                    element.tagName.toLowerCase()
                """
            )

            input_type = (
                await locator.get_attribute(
                    "type"
                )
                or ""
            ).lower()

            if tag_name == "select":
                selected = await select_category(
                    locator,
                    str(value),
                )

                if selected:
                    filled_fields.append(
                        logical_field
                    )
                else:
                    failed_fields.append(
                        {
                            "field":
                                logical_field,
                            "reason":
                                "Matching dropdown "
                                "option not found",
                        }
                    )

            elif input_type in {
                "checkbox",
                "radio",
            }:
                if bool(value):
                    await locator.check()

                filled_fields.append(
                    logical_field
                )

            else:
                if isinstance(value, list):
                    value = ", ".join(
                        str(item)
                        for item in value
                    )

                await locator.fill(
                    str(value)
                )

                filled_fields.append(
                    logical_field
                )

        except Exception as error:
            failed_fields.append(
                {
                    "field": logical_field,
                    "selector":
                        mapping["selector"],
                    "reason": str(error),
                }
            )

            print(
                f"Could not fill "
                f"{logical_field}:",
                str(error),
            )

    return {
        "filled_fields": filled_fields,
        "skipped_fields": skipped_fields,
        "failed_fields": failed_fields,
    }

