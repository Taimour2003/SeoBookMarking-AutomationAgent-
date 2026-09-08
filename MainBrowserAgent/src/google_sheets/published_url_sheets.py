import os
from pathlib import Path

from openpyxl import Workbook, load_workbook


class PublishedUrlSheets:
    def __init__(self, sheet_name="Published_URLS.xlsx"):
        app_dir = Path(os.environ["LOCALAPPDATA"]) / "WebAgent"

        app_dir.mkdir(parents=True, exist_ok=True)

        self.sheet_path = app_dir / sheet_name

        self.file_setup()

    def check_file_presence(self) -> bool:
        return self.sheet_path.exists()

    def create_sheet(self):
        if not self.check_file_presence():
            wb = Workbook()
            ws = wb.active

            ws.append(["Published_URL"])

            wb.save(self.sheet_path)

            print(f"Sheet '{self.sheet_name}' has been created.")
        else:
            print(f"Sheet '{self.sheet_name}' already exists.")

    def file_setup(self):
        if not self.check_file_presence():
            self.create_sheet()
        else:
            print(f"Sheet '{self.sheet_name}' already exists.")

    def submitted_Url(self, published_url):
        try:
            wb = load_workbook(self.sheet_path)
            ws = wb.active

            ws.append([published_url])
            wb.save(self.sheet_path)
            print(
                f"Published URL '{published_url}' has been added to the sheet '{self.sheet_name}'."
            )
        except Exception as e:
            print(f"An error occurred while adding the URL: {e}")

    def display_urls(self):
        if not self.check_file_presence():
            print(f"The sheet does not exist: {self.sheet_path}")
            return

        wb = load_workbook(self.sheet_path)
        ws = wb.active

        print(f"Published URLs in the sheet '{self.sheet_name}':")

        for index, row in enumerate(ws.iter_rows(values_only=True), start=1):
            print(f"{index}: {row[0]}")

    async def download_sheet(self) -> str:
        if not self.check_file_presence():
            raise FileNotFoundError(f"The sheet '{self.sheet_name}' does not exist.")
        return str(self.sheet_path.resolve())
