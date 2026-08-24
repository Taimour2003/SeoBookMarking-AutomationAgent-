from __future__ import annotations


class DataNavigator:
    def __init__(
        self,
        records: list[dict],
    ):
        if not records:
            raise ValueError(
                "No parsed records available."
            )

        self.records = records
        self.current_index = 0

    def current_data(
        self,
    ) -> dict:
        return self.records[
            self.current_index
        ]

    def next_data(
        self,
    ) -> dict:
        if (
            self.current_index
            < len(self.records) - 1
        ):
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
            "current":
                self.current_index + 1,
            "total":
                len(self.records),
            "has_next":
                self.current_index
                < len(self.records) - 1,
            "has_previous":
                self.current_index > 0,
        }