import json
from pathlib import Path


class LocalDataService:
    def __init__(
        self,
        file_path: str,
    ):
        self.file_path = Path(file_path)

    def get_current_record(self) -> dict:
        if not self.file_path.exists():
            raise FileNotFoundError(
                f"Data file not found: {self.file_path}"
            )

        with self.file_path.open(
            "r",
            encoding="utf-8",
        ) as file:
            data = json.load(file)

        if not isinstance(data, dict):
            raise ValueError(
                "Current record must be a JSON object."
            )

        return data