from playwright.async_api import Page


async def inspect_input_fields(
    page: Page,
) -> list[dict]:

    raw_fields = await page.evaluate(
        r"""
        () => {
            const selector =
                "input:not([type='hidden']), select, textarea";

            const elements =
                Array.from(
                    document.querySelectorAll(selector)
                );

            return elements
                .map((el, index) => {

                    const rect =
                        el.getBoundingClientRect();

                    const style =
                        window.getComputedStyle(el);

                    const isVisible =
                        !!(
                            rect.width
                            || rect.height
                            || el.getClientRects().length
                        )
                        && style.visibility !== "hidden"
                        && style.display !== "none";

                    if (!isVisible) {
                        return null;
                    }

                    let labelText = "";

                    if (el.id) {
                        try {
                            const labelEl =
                                document.querySelector(
                                    `label[for="${CSS.escape(el.id)}"]`
                                );

                            if (labelEl) {
                                labelText =
                                    labelEl.innerText;
                            }

                        } catch (e) {}
                    }

                    if (!labelText) {
                        const parentLabel =
                            el.closest("label");

                        if (parentLabel) {
                            labelText =
                                parentLabel.innerText;
                        }
                    }

                    return {
                        index,
                        type:
                            (
                                el.getAttribute("type")
                                || el.tagName
                            ).toLowerCase(),

                        id:
                            el.id || "",

                        name:
                            el.getAttribute("name")
                            || "",

                        placeholder:
                            el.getAttribute(
                                "placeholder"
                            ) || "",

                        autocomplete:
                            el.getAttribute(
                                "autocomplete"
                            ) || "",

                        ariaLabel:
                            el.getAttribute(
                                "aria-label"
                            ) || "",

                        label:
                            labelText.trim(),
                    };
                })
                .filter(Boolean);
        }
        """
    )

    locators = page.locator("input:not([type='hidden']), select, textarea")

    inspected_fields = []

    seen_password_count = 0

    for item in raw_fields:
        element = locators.nth(item["index"])

        search_corpus = " ".join(
            [
                item["id"],
                item["name"],
                item["placeholder"],
                item["autocomplete"],
                item["ariaLabel"],
                item["label"],
            ]
        ).lower()

        field_type = item["type"]

        detected_as = "unknown"

        # --------------------------------
        # EMAIL
        # --------------------------------

        if (
            field_type == "email"
            or "email" in search_corpus
            or "e-mail" in search_corpus
        ):
            detected_as = "email"

        # --------------------------------
        # PASSWORD
        # --------------------------------

        elif field_type == "password" or any(
            keyword in search_corpus
            for keyword in (
                "password",
                "passwd",
                "pwd",
            )
        ):
            seen_password_count += 1

            if any(
                keyword in search_corpus
                for keyword in (
                    "confirm",
                    "re-enter",
                    "reenter",
                    "repeat",
                    "verify",
                )
            ):
                detected_as = "confirm_password"

            elif seen_password_count > 1:
                detected_as = "confirm_password"

            else:
                detected_as = "password"

        # --------------------------------
        # PHONE
        # Put before username
        # --------------------------------

        elif field_type == "tel" or any(
            keyword in search_corpus
            for keyword in (
                "phone",
                "mobile",
                "telephone",
                "phone_number",
                "phone number",
                "mobile_number",
                "mobile number",
            )
        ):
            detected_as = "phone"

        # --------------------------------
        # FIRST NAME
        # --------------------------------

        elif any(
            keyword in search_corpus
            for keyword in (
                "first_name",
                "firstname",
                "first name",
                "fname",
                "given_name",
                "given name",
                "forename",
            )
        ):
            detected_as = "first_name"

        # --------------------------------
        # LAST NAME
        # --------------------------------

        elif any(
            keyword in search_corpus
            for keyword in (
                "last_name",
                "lastname",
                "last name",
                "lname",
                "surname",
                "family_name",
                "family name",
            )
        ):
            detected_as = "last_name"

        # --------------------------------
        # FULL NAME
        # --------------------------------

        elif any(
            keyword in search_corpus
            for keyword in (
                "full_name",
                "fullname",
                "full name",
                "your name",
            )
        ):
            detected_as = "full_name"

        # --------------------------------
        # USERNAME
        # --------------------------------

        elif any(
            keyword in search_corpus
            for keyword in (
                "username",
                "user_name",
                "user name",
                "handle",
                "login_name",
                "login name",
                "reg_username",
            )
        ):
            detected_as = "username"

        # --------------------------------
        # CHECKBOX
        # --------------------------------

        elif field_type == "checkbox":
            detected_as = "terms_checkbox"

        inspected_fields.append(
            {
                "element": element,
                "type": field_type,
                "id": item["id"],
                "name": item["name"],
                "placeholder": item["placeholder"],
                "autocomplete": item["autocomplete"],
                "ariaLabel": item["ariaLabel"],
                "label": item["label"],
                "detected_as": detected_as,
            }
        )

    return inspected_fields
