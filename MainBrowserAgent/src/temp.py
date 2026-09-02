# async with async_playwright() as playwright:
#     try:
#         initial_page = await browser_manager.start(playwright)

#         if not browser_manager.context:
#             raise RuntimeError("Browser context is not available.")

#         page_manager = ActivePageManager(
#             browser_manager.context,
#             initial_page,
#         )

#         url_queue = asyncio.Queue()

#         timeout_failed_urls = []  # Timeout hone wale URLs ka list

#         for url in urls_from_sheet:
#             await url_queue.put(url)

#         for i in range(max_concurrent_pages):
#             asyncio.create_task(
#                 url_worker(
#                     worker_id=i + 1,
#                     context=browser_manager.context,
#                     url_queue=url_queue,
#                     failed_urls=timeout_failed_urls,
#                 )
#             )

#         print("[SHEET] Waiting for data before panel loop...")

#         data_navigator, signup_data = await sheet_task

#         print("[SHEET] Data ready.")

#         while True:
#             try:
#                 await prepare_all_pages(page_manager, data_navigator)

#                 page, action = await find_clicked_action(page_manager)

#                 if page is None or action is None:
#                     await asyncio.sleep(0.1)
#                     continue

#                 security_status = await detect_security_page(page)

#                 if action == "FILL":
#                     if security_status in {
#                         "CLOUDFLARE_REQUIRED",
#                         "MANUAL_LOGIN_REQUIRED",
#                     }:
#                         await set_panel_state(page, "blocked")
#                         await update_panel_status(
#                             page,
#                             "Cloudflare verification must be completed manually.",
#                         )
#                         continue

#                     await update_panel_status(
#                         page,
#                         "Reading data and filling form...",
#                     )

#                     data = data_navigator.current_data()

#                     result = await assistant.fill_current_page(
#                         page,
#                         data,
#                     )

#                     filled = ", ".join(
#                         result.get(
#                             "filled_fields",
#                             [],
#                         )
#                     )

#                     unresolved_count = len(
#                         result.get(
#                             "unresolved_fields",
#                             [],
#                         )
#                     )

#                     skipped_count = len(
#                         result.get(
#                             "skipped_fields",
#                             [],
#                         )
#                     )

#                     failed_count = len(
#                         result.get(
#                             "failed_fields",
#                             [],
#                         )
#                     )

#                     await set_ai_fix_enabled(page, False)
#                     await set_panel_state(
#                         page, "error" if failed_count else "ready"
#                     )

#                     await update_panel_status(
#                         page,
#                         (
#                             f"Filled: {filled or 'none'}. "
#                             f"Skipped: {skipped_count}. "
#                             f"Failed: {failed_count}. "
#                             f"Unresolved: {unresolved_count}."
#                         ),
#                     )

#                 elif action == "SUBMIT":
#                     if security_status:
#                         await set_panel_state(
#                             page,
#                             "blocked",
#                         )
#                         await update_panel_status(
#                             page,
#                             "Security verification appeared. Complete it manually.",
#                         )
#                         print(
#                             "Security challenge detected:",
#                             security_status,
#                             page.url,
#                         )
#                         continue

#                     await update_panel_status(
#                         page,
#                         "Submitting form...",
#                     )

#                     result = await assistant.submit_current_page(page)
#                     print("Submit result:", result)
#                     if result.get("success"):
#                         print("Form submitted successfully.")
#                         published_url = result.get("published_url")
#                         published_url_sheets.submitted_Url(published_url)
#                         published_url_sheets.display_urls()
#                     post_submit_security = await detect_security_page(page)

#                     if post_submit_security:
#                         await safely_install_panel(page)
#                         await set_panel_state(page, "blocked")
#                         await set_ai_fix_enabled(page, False)
#                         await update_panel_status(
#                             page,
#                             "Security verification appeared. Complete it manually.",
#                         )
#                         print(
#                             "Security verification appeared after submission:",
#                             post_submit_security,
#                         )
#                         continue

#                     print(
#                         "Submit result:",
#                         result,
#                     )
#                     await safely_install_panel(page)
#                     await update_ai_state(
#                         page,
#                         result,
#                     )

#                 elif action == "FILL_SIGNUP":
#                     await update_panel_status(page, "Filling signup form...")

#                     if security_status:
#                         await set_panel_state(page, "blocked")
#                         await update_panel_status(
#                             page,
#                             "Security verification appeared. Complete it manually.",
#                         )
#                         print(
#                             "Security challenge detected:",
#                             security_status,
#                             page.url,
#                         )
#                         continue

#                     try:
#                         if not signup_data:
#                             await update_panel_status(
#                                 page, "No sheet loaded! click"
#                             )
#                         else:
#                             await fill_signup_form(page, signup_data)
#                             await update_panel_status(
#                                 page, "Signup form filled successfully!"
#                             )
#                     except Exception as e:
#                         print(f"[SIGNUP ERROR] Failed to fill form: {e}")
#                         await update_panel_status(
#                             page, "Failed to auto-fill signup form."
#                         )

#                 elif action == "AI_FIX":
#                     if security_status:
#                         await set_panel_state(
#                             page,
#                             "blocked",
#                         )
#                         await update_panel_status(
#                             page,
#                             "Security verification appeared. Complete it manually.",
#                         )
#                         print(
#                             "Security challenge detected:",
#                             security_status,
#                             page.url,
#                         )
#                         continue

#                     result = await handle_ai_action(
#                         page,
#                         assistant,
#                     )

#                     print(
#                         "AI action result:",
#                         result,
#                     )

#                     await safely_install_panel(page)
#                     await update_ai_state(
#                         page,
#                         result,
#                     )

#                 elif action == "REFRESH":
#                     await safely_install_panel(page)
#                     await set_panel_state(page, "ready")
#                     await update_panel_status(
#                         page,
#                         "Agent refreshed.",
#                     )

#                 elif action == "CURRENT_DATA":
#                     current_data = data_navigator.current_data()

#                     position = data_navigator.position()

#                     await update_current_data_display(
#                         page,
#                         current_data,
#                         position,
#                         open_view=True,
#                     )

#                 elif action == "NEXT_DATA":
#                     current_data = data_navigator.next_data()

#                     position = data_navigator.position()

#                     await update_current_data_display(
#                         page,
#                         current_data,
#                         position,
#                         open_view=False,
#                     )

#                     await update_panel_status(
#                         page,
#                         (
#                             f"Next data selected. "
#                             f"Entry "
#                             f"{position['current']} "
#                             f"of "
#                             f"{position['total']}."
#                         ),
#                     )

#                     print(
#                         "Current data changed to:",
#                         current_data,
#                     )

#                 elif action == "PREVIOUS_DATA":
#                     current_data = data_navigator.previous_data()

#                     position = data_navigator.position()

#                     await update_current_data_display(
#                         page,
#                         current_data,
#                         position,
#                         open_view=False,
#                     )

#                     await update_panel_status(
#                         page,
#                         (
#                             f"Previous data selected. "
#                             f"Entry "
#                             f"{position['current']} "
#                             f"of "
#                             f"{position['total']}."
#                         ),
#                     )

#                     print(
#                         "Current data changed to:",
#                         current_data,
#                     )

#                 elif action == "SUBMIT_URL":
#                     current_data = data_navigator.current_data()

#                     url = current_data.get(
#                         "website_url", current_data.get("url", "")
#                     )

#                     if not url:
#                         await set_panel_state(
#                             page,
#                             "error",
#                         )

#                         await update_panel_status(
#                             page,
#                             ("Current spreadsheet entry does not contain a URL."),
#                         )

#                         continue

#                     print(
#                         "Submitting URL to the website:",
#                         url,
#                     )

#                     await update_panel_status(
#                         page,
#                         f"Submitting URL: {url}",
#                     )

#                     result = await enter_current_url(page, url)

#                     print("SUBMIT_URL result:", result)

#                 elif action == "SAVE_BACKLINK":
#                     published_url = page.url
#                     published_url_sheets.submitted_Url(published_url)
#                     published_url_sheets.display_urls()
#                     current_data = data_navigator.current_data()
#                     print(f"[BACKLINK SAVED] URL: {published_url}")

#                     await set_panel_state(page, "success")

#                     await update_panel_status(
#                         page,
#                         f"Backlink saved successfully!\n{published_url[:40]}...",
#                     )

#                 elif action == "DOWNLOAD_SHEET":
#                     print("Downloading updated spreadsheet...")
#                     await update_panel_status(
#                         page, "Downloading spreadsheet data..."
#                     )

#                     try:
#                         # Save or export the updated spreadsheet file
#                         filepath = await published_url_sheets.download_sheet()

#                         await set_panel_state(page, "success")
#                         await update_panel_status(
#                             page, f"Sheet successfully downloaded: {filepath}"
#                         )
#                         print("Sheet downloaded successfully to:", filepath)
#                     except Exception as error:
#                         await set_panel_state(page, "error")
#                         await update_panel_status(
#                             page, f"Failed to download sheet: {str(error)}"
#                         )
#                         print("Error downloading sheet:", str(error))

#                 elif action == "CHANGE_GOOGLESHEET":
#                     data_navigator, signup_data = await load_sheet_navigator(
#                         force_reload=True
#                     )
#                     await update_panel_status(
#                         page, "Google Sheet updated successfully in main.py!"
#                     )

#                 else:
#                     print(
#                         "Unknown panel action:",
#                         action,
#                     )

#             except Exception as error:
#                 print(
#                     "Agent loop error:",
#                     str(error),
#                 )
#                 await asyncio.sleep(1)

#     finally:
#         await browser_manager.close()
