from playwright.async_api import Page

from .input_field_inspector import inspect_input_fields


async def fill_signup_form(page:Page, user_data: dict):
    inspected_fields = await inspect_input_fields(page)
    
    for field in inspected_fields:
        detected = field["detected_as"]
        element = field["element"]
        
        # 1. Unknown fields skip karein
        if detected == "unknown":
            continue

        try:
            # 2. Special Case: Company / Business Email
            if detected == "email" and user_data.get("company_email"):
                corpus = f"{field['id']} {field['name']} {field['label']}".lower()
                if any(k in corpus for k in ["company", "business", "work"]):
                    await element.fill(str(user_data["company_email"]))
                    print(f"Filled [Company Email]: {user_data['company_email']}")
                    continue

            # 3. Special Case: Confirm Password (Fallback to main password)
            if detected == "confirm_password":
                pwd = user_data.get("confirm_password") or user_data.get("password")
                if pwd:
                    await element.fill(str(pwd))
                    print(f"Filled [Confirm Password]: {pwd}")
                    continue

            # 4. Special Case: Single Full Name Field
            if detected == "full_name":
                full_name = f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}".strip()
                if full_name:
                    await element.fill(full_name)
                    print(f"Filled [Full Name]: {full_name}")
                    continue

            # 5. Special Case: Terms & Conditions Checkbox
            if detected == "terms_checkbox" or field["type"] == "checkbox":
                if not await element.is_checked():
                    await element.check()
                    print("Checked [Terms Checkbox]")
                    continue

            # 6. Normal Direct Matching (email, password, username, first_name, last_name, etc.)
            if detected in user_data and user_data[detected]:
                value = str(user_data[detected])
                await element.fill(value)
                print(f"Filled [{detected}]: {value}")

        except Exception as err:
            print(f"[FILL ERROR] Field '{detected}' fill nahi ho saka: {err}")
            continue