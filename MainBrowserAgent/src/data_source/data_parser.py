from __future__ import annotations


def parse_sheet_entries(raw_rows: list[list[str]]) -> list[dict]:

    if not raw_rows:
        return []

    header_values = [
        "title",
        "keywords",
        "url",
        "long description",
    ]

    header_row_index = -1

    for index, row in enumerate(raw_rows):
        row_lowercase = [str(cell).strip().lower() for cell in row]

        if all(
            any(header_value in cell for cell in row_lowercase)
            for header_value in header_values
        ):
            header_row_index = index
            break

    if header_row_index == -1:
        raise ValueError("Required header row not found.")

    complete_data = []
    data_dict = {}

    for row in raw_rows[header_row_index + 1 :]:
        # Safe cell reads
        title = row[0].strip() if len(row) > 0 else ""

        keyword = row[1].strip() if len(row) > 1 else ""

        keyword_type = row[2].strip() if len(row) > 2 else ""

        url = row[3].strip() if len(row) > 3 else ""

        long_description = row[4].strip() if len(row) > 4 else ""

        if keyword_type.lower() == "primary":
            data_dict = {
                "title": title,
                "keywords": keyword,
                "primary_keyword": keyword,
                "website_url": url,
                "url": url,
                "tags": [keyword],
            }

        if long_description:
            if not data_dict:
                continue

            data_dict["long_description"] = long_description

            complete_data.append(data_dict.copy())

            data_dict = {}

    return complete_data


class DataNavigator:
    def __init__(
        self,
        records: list[dict],
    ):
        if not records:
            raise ValueError("No parsed records available.")

        self.records = records
        self.current_index = 0

    def current_data(
        self,
    ) -> dict:
        return self.records[self.current_index]

    def next_data(
        self,
    ) -> dict:
        if self.current_index < len(self.records) - 1:
            self.current_index += 1

        return self.current_data()

    def previous_data(
        self,
    ) -> dict:
        if self.current_index > 0:
            self.current_index -= 1

        return self.current_data()

    def position(
        self,
    ) -> dict:
        return {
            "current": self.current_index + 1,
            "total": len(self.records),
            "has_next": self.current_index < len(self.records) - 1,
            "has_previous": self.current_index > 0,
        }
