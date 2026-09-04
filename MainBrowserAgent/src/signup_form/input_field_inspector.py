
from playwright.async_api import Page


async def inspect_input_fields(page: Page) -> list[dict]:
    
    # Single browser round-trip mein saare visible elements extracting
    raw_fields = await page.evaluate(r"""
        () => {
            const selector = "input:not([type='hidden']), select, textarea";
            const elements = Array.from(document.querySelectorAll(selector));
            
            return elements.map((el, index) => {
                // Visibility Check
                const rect = el.getBoundingClientRect();
                const isVisible = !!(rect.width || rect.height || el.getClientRects().length) && 
                                  window.getComputedStyle(el).visibility !== 'hidden' &&
                                  window.getComputedStyle(el).display !== 'none';

                if (!isVisible) return null;

                // Label Text Extraction (Associated label or Ancestor label)
                let labelText = "";
                if (el.id) {
                    try {
                        const labelEl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
                        if (labelEl) labelText = labelEl.innerText;
                    } catch(e) {}
                }
                if (!labelText) {
                    const parentLabel = el.closest("label");
                    if (parentLabel) labelText = parentLabel.innerText;
                }

                return {
                    index: index,
                    type: (el.getAttribute("type") || el.tagName).toLowerCase(),
                    id: el.id || "",
                    name: el.getAttribute("name") || "",
                    placeholder: el.getAttribute("placeholder") || "",
                    autocomplete: el.getAttribute("autocomplete") || "",
                    ariaLabel: el.getAttribute("aria-label") || "",
                    label: labelText.trim()
                };
            }).filter(Boolean);
        }
    """)

    locators = page.locator("input:not([type='hidden']), select, textarea")
    inspected_fields = []
    seen_password_count = 0

    for item in raw_fields:
        # Re-bind locator using fast nth index reference
        el = locators.nth(item["index"])
        
        search_corpus = f"{item['id']} {item['name']} {item['placeholder']} {item['autocomplete']} {item['ariaLabel']} {item['label']}".lower()
        field_type = item["type"]
        detected_as = "unknown"

        # 1. Email Check (Native type or keyword)
        if field_type == "email" or "email" in search_corpus or "e-mail" in search_corpus:
            detected_as = "email"

        # 2. Password & Confirm Password Check (Sequential Fallback)
        elif field_type == "password" or any(k in search_corpus for k in ["pass", "pwd", "password"]):
            seen_password_count += 1
            if any(k in search_corpus for k in ["confirm", "re-enter", "repeat", "verify"]):
                detected_as = "confirm_password"
            elif seen_password_count > 1:
                # Agar 2nd password input mile bina keyword ke, tab bhi match confirm_password set hoga
                detected_as = "confirm_password"
            else:
                detected_as = "password"

        # 3. First Name Check
        elif any(k in search_corpus for k in ["first", "fname", "given", "forename"]):
            detected_as = "first_name"

        # 4. Last Name Check
        elif any(k in search_corpus for k in ["last", "lname", "surname", "family"]):
            detected_as = "last_name"

        # 5. Username Check
        elif any(k in search_corpus for k in ["user", "username", "handle", "login"]):
            detected_as = "username"

        # 6. Phone Check
        elif field_type == "tel" or any(k in search_corpus for k in ["phone", "mobile", "tel"]):
            detected_as = "phone"

        inspected_fields.append({
            "element": el,
            "type": field_type,
            "id": item["id"],
            "name": item["name"],
            "placeholder": item["placeholder"],
            "label": item["label"],
            "detected_as": detected_as
        })

    return inspected_fields