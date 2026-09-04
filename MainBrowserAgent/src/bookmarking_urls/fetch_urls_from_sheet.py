from config import settings

import gspread

def fetch_bookmarking_urls_from_sheet() -> list[str]:
    spreadsheet_id = settings.BookmarkingSitesSheetId
    worksheet_name = settings.BookmarkingSitesSheetName
    credentials_file = settings.GOOGLE_SERVICE_ACCOUNT_FILE

    print("Fetching URLs from Google Sheet...")
    print(f"Spreadsheet ID: {spreadsheet_id}")
    print(f"Worksheet Name: {worksheet_name}")
    print(f"Credentials File: {credentials_file}")

    if not spreadsheet_id or not worksheet_name or not credentials_file:
        raise ValueError(
            "Google Sheet ID, worksheet name, or credentials file is not set in the environment variables."
        )

    gc = gspread.service_account(filename=credentials_file)

    sh = gc.open_by_key(spreadsheet_id)
    worksheet = sh.worksheet(worksheet_name)

    urls = worksheet.col_values(1)  # Assuming URLs are in the first column

    cleaned_urls = [
        url.strip() for url in urls if url.strip()
    ]  # Remove empty and whitespace-only entries

    return cleaned_urls

