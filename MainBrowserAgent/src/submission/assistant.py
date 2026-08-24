from __future__ import annotations

import ai.error_fix_service
import ai.page_context_builder
import forms.action_detector
import forms.classifier
import forms.filler
import forms.inspector
import playwright.async_api

import submission.ai_recovery
import submission.form_errors

import asyncio


class SubmissionAssistant:
    def __init__(self):
        self.current_mappings: list[dict] = []
        self.current_data: dict = {}
        self.last_errors: list[str] = []
        self.last_submit_result: dict | None = None
        self.ai_fix_service = ai.error_fix_service.AiErrorFixService()
        self.ai_retry_count = 0
        self.max_ai_retries = 2
        self.ai_fix_service = ai.error_fix_service.AiErrorFixService()

    # async def ai_fix_and_resubmit(
    #     self,
    #     page,
    # ) -> dict:
    #     if not self.current_mappings:
    #         return {
    #             "success": False,
    #             "status":
    #                 "FORM_NOT_PREPARED",
    #             "message":
    #                 "Fill Current Page first.",
    #         }

    #     if (
    #         self.ai_retry_count
    #         >= self.max_ai_retries
    #     ):
    #         return {
    #             "success": False,
    #             "status":
    #                 "AI_RETRY_LIMIT_REACHED",
    #             "message":
    #                 "Maximum AI retries reached.",
    #         }

    #     errors = await read_form_errors(
    #         page
    #     )

    #     if not errors:
    #         errors = self.last_errors

    #     if not errors:
    #         return {
    #             "success": False,
    #             "status":
    #                 "NO_VISIBLE_ERRORS",
    #             "message":
    #                 "No validation errors detected.",
    #         }

    #     page_context = (
    #         await build_ai_page_context(
    #             page=page,
    #             errors=errors,
    #             mappings=
    #                 self.current_mappings,
    #             current_data=
    #                 self.current_data,
    #         )
    #     )

    #     patch = (
    #         self.ai_fix_service
    #         .create_patch(page_context)
    #     )

    #     if (
    #         patch["status"]
    #         != "PATCH_AVAILABLE"
    #     ):
    #         return {
    #             "success": False,
    #             "status": "NO_SAFE_AI_PATCH",
    #             "message": patch["reason"],
    #             "patch": patch,
    #         }

    #     recovery = await apply_ai_patch(
    #         page=page,
    #         patch=patch,
    #         mappings=self.current_mappings,
    #         current_data=self.current_data,
    #     )

    #     if not recovery["success"]:
    #         return {
    #             "success": False,
    #             "status":
    #                 "AI_PATCH_FILL_FAILED",
    #             "message":
    #                 "AI patch could not be filled.",
    #             "recovery": recovery,
    #         }

    #     self.current_data = recovery[
    #         "updated_data"
    #     ]

    #     self.ai_retry_count += 1

    #     if not patch.get(
    #         "should_resubmit"
    #     ):
    #         return {
    #             "success": "FALSE",
    #             "status": "AI_PATCH_APPLIED",
    #             "message":
    #                 "Patch applied; manual submit required.",
    #             "patch": patch,
    #         }

    #     submit_result = (
    #         await self.submit_current_page(
    #             page,
    #             # max_attempts=1,
    #         )
    #     )

    #     final_result = {
    #         "success": submit_result.get(
    #             "success",
    #             False,
    #         ),
    #         "status": submit_result.get(
    #             "status",
    #             "UNKNOWN",
    #         ),
    #         "message": submit_result.get(
    #             "message",
    #             "",
    #         ),
    #         "patch": patch,
    #         "submission": submit_result,
    #     }

    #     self.last_submit_result = final_result

    #     return final_result

    def _store_submit_result(self, result: dict) -> dict:
        self.last_submit_result = result
        return result

    async def fill_current_page(
        self,
        page: playwright.async_api.Page,
        data: dict,
    ) -> dict:
        fields = await forms.inspector.inspect_fields(page)

        mappings: list[dict] = []
        unresolved: list[dict] = []

        print("Fields detected on the page:", fields)

        for field in fields:
            logical_field, confidence = forms.classifier.classify_field(field)

            if logical_field and confidence >= 80:
                mappings.append(
                    {
                        "logical_field": logical_field,
                        "selector": field["selector"],
                        "confidence": confidence,
                    }
                )

            elif field["required"]:
                unresolved.append(field)

        print("Field mappings:", mappings)
        print("Unresolved required fields:", unresolved)

        fill_result = await forms.filler.fill_fields(
            page=page,
            mappings=mappings,
            data=data,
        )

        self.current_mappings = mappings
        self.current_data = data
        self.last_errors = []
        self.last_submit_result = None
        self.ai_retry_count = 0

        return {
            "success": (len(fill_result["failed_fields"]) == 0),
            "status": "FORM_FILLED",
            "filled_fields": fill_result["filled_fields"],
            "skipped_fields": fill_result["skipped_fields"],
            "failed_fields": fill_result["failed_fields"],
            "unresolved_fields": unresolved,
            "mappings": mappings,
        }

    async def submit_current_page(
        self,
        page: playwright.async_api.Page,
    ) -> dict:
        submit_button = await forms.action_detector.find_submit_button(page)

        if not submit_button:
            return self._store_submit_result(
                {
                    "success": False,
                    "status": "SUBMIT_BUTTON_NOT_FOUND",
                    "message": ("No sufficiently reliable submit control was found."),
                    "errors": [],
                    "page_url": page.url,
                }
            )

        old_url = page.url

        before_errors = await submission.form_errors.read_form_errors(page)

        try:
            await submit_button.scroll_into_view_if_needed()

            await submit_button.click(timeout=10_000)

        except Exception as error:
            return self._store_submit_result(
                {
                    "success": False,
                    "status": "SUBMIT_CLICK_FAILED",
                    "message": ("Submit control was found but could not be clicked."),
                    "error": str(error),
                    "errors": [],
                    "page_url": page.url,
                }
            )

        # Give normal navigation a chance.
        try:
            await page.wait_for_load_state(
                "domcontentloaded",
                timeout=10_000,
            )
        except Exception:
            pass

        # Also allow AJAX/client-side validation.
        await asyncio.sleep(1.5)

        errors = list(
            dict.fromkeys(await submission.form_errors.read_form_errors(page))
        )

        if errors:
            self.last_errors = errors

            return self._store_submit_result(
                {
                    "success": False,
                    "status": "VALIDATION_FAILED",
                    "message": "Form validation errors detected.",
                    "errors": errors,
                    "previous_errors": before_errors,
                    "page_url": page.url,
                }
            )

        # Check whether a security/human step appeared.
        body_text = (await page.locator("body").inner_text()).lower()

        human_patterns = (
            "verify you are human",
            "captcha",
            "security verification",
            "enter the following",
            "verification code",
            "confirm you are human",
        )

        matched_human = next(
            (text for text in human_patterns if text in body_text),
            None,
        )

        if matched_human:
            return self._store_submit_result(
                {
                    "success": False,
                    "status": "HUMAN_ACTION_REQUIRED",
                    "message": ("The website requires a manual verification step."),
                    "reason": matched_human,
                    "errors": [],
                    "page_url": page.url,
                }
            )

        success_patterns = (
            "bookmark added successfully",
            "bookmark submitted successfully",
            "successfully submitted",
            "submitted successfully",
            "successfully added",
            "successfully saved",
            "submission received",
            "bookmark saved",
            "bookmark added",
            "story submitted",
            "story added",
            "link submitted",
            "link added",
            "article submitted",
            "post published",
            "published successfully",
            "pending approval",
            "awaiting approval",
            "submitted for review",
            "thank you for your submission",
        )

        matched_success = next(
            (pattern for pattern in success_patterns if pattern in body_text),
            None,
        )

        if matched_success:
            self.last_errors = []
            self.ai_retry_count = 0

            return self._store_submit_result(
                {
                    "success": True,
                    "status": "FORM_SUBMITTED",
                    "message": matched_success,
                    "errors": [],
                    "page_url": page.url,
                }
            )

        # Important:
        # maybe the first stage succeeded and
        # another form is now being shown.
        next_submit = await forms.action_detector.find_submit_button(page)

        if next_submit:
            return self._store_submit_result(
                {
                    "success": False,
                    "status": "NEXT_SUBMISSION_STEP",
                    "message": (
                        "Current submission step "
                        "completed, but another "
                        "submission step appears "
                        "to be available."
                    ),
                    "errors": [],
                    "old_url": old_url,
                    "page_url": page.url,
                }
            )

        if page.url != old_url:
            return self._store_submit_result(
                {
                    "success": False,
                    "status": "SUBMISSION_UNVERIFIED",
                    "message": (
                        "Page changed after submission, "
                        "but reliable final-success "
                        "evidence was not found."
                    ),
                    "errors": [],
                    "old_url": old_url,
                    "page_url": page.url,
                }
            )

        return self._store_submit_result(
            {
                "success": False,
                "status": "SUBMISSION_UNVERIFIED",
                "message": (
                    "Submit action was performed, "
                    "but the resulting page state "
                    "could not be classified safely."
                ),
                "errors": [],
                "page_url": page.url,
            }
        )

    # async def submit_current_page(self, page: Page) -> dict:
    #     submit_button = await find_submit_button(page)
    #     if not submit_button:
    #         return self._store_submit_result(
    #             {
    #                 "success": False,
    #                 "status": "SUBMIT_BUTTON_NOT_FOUND",
    #                 "message": "Safe submit button was not found.",
    #                 "errors": [],
    #                 "page_url": page.url,
    #             }
    #         )

    #     old_url = page.url
    #     before_errors = await read_form_errors(page)
    #     await submit_button.click()

    #     try:
    #         await page.wait_for_load_state(
    #             "domcontentloaded",
    #             timeout=10_000,
    #         )
    #     except Exception:
    #         pass

    #     await asyncio.sleep(1.5)
    #     errors = list(dict.fromkeys(await read_form_errors(page)))

    #     if errors:
    #         self.last_errors = errors
    #         return self._store_submit_result(
    #             {
    #                 "success": False,
    #                 "status": "VALIDATION_FAILED",
    #                 "message": "Form validation errors detected.",
    #                 "errors": errors,
    #                 "previous_errors": before_errors,
    #                 "page_url": page.url,
    #             }
    #         )

    #     body_text = (await page.locator("body").inner_text()).lower()
    #     success_patterns = (
    #         "bookmark added successfully",
    #         "bookmark submitted successfully",
    #         "successfully submitted",
    #         "submitted successfully",
    #         "successfully added",
    #         "pending approval",
    #         "submitted for review",
    #         "thank you for your submission",
    #     )
    #     matched_success = next(
    #         (pattern for pattern in success_patterns if pattern in body_text),
    #         None,
    #     )
    #     if matched_success:
    #         self.last_errors = []
    #         self.ai_retry_count = 0
    #         return self._store_submit_result(
    #             {
    #                 "success": True,
    #                 "status": "FORM_SUBMITTED",
    #                 "message": matched_success,
    #                 "errors": [],
    #                 "page_url": page.url,
    #             }
    #         )

    #     if page.url != old_url:
    #         return self._store_submit_result(
    #             {
    #                 "success": False,
    #                 "status": "SUBMISSION_UNVERIFIED",
    #                 "message": (
    #                     "Page URL changed, but no reliable "
    #                     "success message or published result "
    #                     "was detected."
    #                 ),
    #                 "errors": [],
    #                 "old_url": old_url,
    #                 "page_url": page.url,
    #             }
    #         )

    #     return self._store_submit_result(
    #         {
    #             "success": False,
    #             "status": "SUBMISSION_UNVERIFIED",
    #             "message": (
    #                 "Submit was clicked, but neither a success confirmation "
    #                 "nor a validation error was detected."
    #             ),
    #             "errors": [],
    #             "page_url": page.url,
    #         }
    #     )

    async def ai_fix_and_resubmit(self, page: playwright.async_api.Page) -> dict:
        if not self.current_mappings:
            return {
                "success": False,
                "status": "FORM_NOT_PREPARED",
                "message": "Run Fill Current Page first.",
            }

        if self.ai_retry_count >= self.max_ai_retries:
            return {
                "success": False,
                "status": "AI_RETRY_LIMIT_REACHED",
                "message": "Maximum AI retries reached.",
            }

        errors = await submission.form_errors.read_form_errors(page) or self.last_errors
        if not errors:
            return {
                "success": False,
                "status": "NO_VISIBLE_ERRORS",
                "message": "No validation errors were detected.",
            }

        page_context = await ai.page_context_builder.build_ai_page_context(
            page=page,
            errors=errors,
            mappings=self.current_mappings,
            current_data=self.current_data,
        )

        # Groq's sync SDK call should not block the asyncio event loop.
        patch = await asyncio.to_thread(
            self.ai_fix_service.create_patch,
            page_context,
        )

        if patch.get("status") != "PATCH_AVAILABLE":
            return {
                "success": False,
                "status": "NO_SAFE_AI_PATCH",
                "message": patch.get("reason", "No safe AI patch was available."),
                "patch": patch,
            }

        recovery = await submission.ai_recovery.apply_ai_patch(
            page=page,
            patch=patch,
            mappings=self.current_mappings,
            current_data=self.current_data,
        )

        if not recovery.get("success"):
            return {
                "success": False,
                "status": "AI_PATCH_FILL_FAILED",
                "message": "The AI patch could not be filled into the form.",
                "recovery": recovery,
            }

        self.current_data = recovery["updated_data"]
        self.ai_retry_count += 1

        if not patch.get("should_resubmit"):
            result = {
                "success": False,
                "status": "AI_PATCH_APPLIED",
                "message": "AI patch applied; manual submit is still required.",
                "patch": patch,
            }
            self.last_submit_result = result
            return result

        submit_result = await self.submit_current_page(page)
        final_result = {
            "success": submit_result.get("success", False),
            "status": submit_result.get("status", "UNKNOWN"),
            "message": submit_result.get("message", ""),
            "errors": submit_result.get("errors", []),
            "patch": patch,
            "submission": submit_result,
        }
        self.last_submit_result = final_result
        return final_result

    def _store_submit_result(
        self,
        result: dict,
    ) -> dict:
        self.last_submit_result = result
        return result
