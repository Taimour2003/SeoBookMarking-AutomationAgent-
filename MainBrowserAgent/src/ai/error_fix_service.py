from __future__ import annotations

import json

from groq import Groq

from config import settings


ALLOWED_PATCH_FIELDS = {
    "title",
    "website_url",
    "short_description",
    "long_description",
    "category",
    "tags",
    "company_name",
}


class AiErrorFixService:
    def __init__(self):
        if not settings.groq_api_key:
            raise RuntimeError("GROQ_API_KEY is missing.")

        self.client = Groq(api_key=settings.groq_api_key)

    def create_patch(
        self,
        page_context: dict,
    ) -> dict:
        system_prompt = """
You are a form validation repair assistant.

Analyse the visible form errors, current data,
field mappings and compressed interactive HTML.

Return ONLY valid JSON with this structure:

{
  "status": "PATCH_AVAILABLE" | "NO_SAFE_PATCH",
  "reason": "short explanation",
  "changes": {
    "<logical_field>": {
      "old_value": "...",
      "new_value": "...",
      "reason": "..."
    }
  },
  "should_resubmit": true | false
}

Strict rules:
1. Modify only values needed to resolve visible errors.
2. Never invent business facts.
3. Never modify email, password, account credentials,
   CAPTCHA, OTP, payment or security fields.
4. Never return selectors, JavaScript, Python or XPath.
5. Allowed logical fields:
   title, website_url, short_description,
   long_description, category, tags, company_name.
6. Respect length limits found in errors or HTML.
7. If no safe correction is possible, return NO_SAFE_PATCH.
"""

        response = self.client.chat.completions.create(
            model=settings.groq_model,
            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        page_context,
                        ensure_ascii=False,
                    ),
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
        )

        raw_result = json.loads(response.choices[0].message.content)

        return self._validate_patch(
            raw_result,
            page_context.get(
                "current_data",
                {},
            ),
        )

    def _validate_patch(
        self,
        patch: dict,
        current_data: dict,
    ) -> dict:
        if patch.get("status") != "PATCH_AVAILABLE":
            return {
                "status": "NO_SAFE_PATCH",
                "reason": patch.get(
                    "reason",
                    "AI could not produce a safe patch.",
                ),
                "changes": {},
                "should_resubmit": False,
            }

        safe_changes = {}

        for field, change in patch.get(
            "changes",
            {},
        ).items():
            if field not in ALLOWED_PATCH_FIELDS:
                continue

            if not isinstance(change, dict):
                continue

            new_value = change.get("new_value")

            if new_value in (None, ""):
                continue

            safe_changes[field] = {
                "old_value": current_data.get(field),
                "new_value": new_value,
                "reason": change.get(
                    "reason",
                    "Validation repair",
                ),
            }

        if not safe_changes:
            return {
                "status": "NO_SAFE_PATCH",
                "reason": ("No allowed field changes were returned."),
                "changes": {},
                "should_resubmit": False,
            }

        return {
            "status": "PATCH_AVAILABLE",
            "reason": patch.get(
                "reason",
                "Validation repair available.",
            ),
            "changes": safe_changes,
            "should_resubmit": bool(
                patch.get(
                    "should_resubmit",
                    False,
                )
            ),
        }
