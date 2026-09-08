from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

import sys


BookmarkingSitesSheetId = "1eDDKR_ondkto7xP3VUPVVC42ecDzV0jePO73dM4bMCw"
BookmarkingSitesSheetName = "BookmarkingSites"


GROQ_API_KEY = "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"
GROQ_MODEL = "llama-3.3-70b-versatile"

# Project root:
# WebAgent/
# ├── .env
# ├── data/
# └── src/
#     └── config.py


def get_project_root() -> Path:
    if getattr(sys, "frozen", False):
        # Running as PyInstaller EXE
        return Path(sys.executable).resolve().parent

    # Running from Python source
    return Path(__file__).resolve().parent.parent


PROJECT_ROOT = get_project_root()

ENV_FILE = PROJECT_ROOT / ".env"

load_dotenv(
    dotenv_path=ENV_FILE,
    override=False,
)


def _env_bool(
    key: str,
    default: bool = False,
) -> bool:
    value = os.getenv(key)

    if value is None:
        return default

    return value.strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def _env_int(
    name: str,
    default: int,
) -> int:
    value = os.getenv(name)

    if value is None:
        return default

    try:
        return int(value)
    except ValueError as error:
        raise ValueError(f"{name} must be an integer. Received: {value} ") from error


@dataclass(frozen=True)
class Settings:
    # Application
    app_name: str
    app_env: str

    # Browser
    browser_mode: str
    cdp_url: str
    headless: bool
    slow_mo: int
    default_timeout: int
    navigation_timeout: int
    ignore_https_errors: bool

    # Persistent Chrome profile
    browser_channel: str
    browser_profile_dir: Path
    start_url: str

    # Data source
    current_record_path: Path
    default_category: str

    # AI fallback
    use_ai_fallback: bool
    groq_api_key: str | None
    groq_model: str

    BookmarkingSitesSheetId: str
    BookmarkingSitesSheetName: str

    GOOGLE_SERVICE_ACCOUNT_FILE: str


def get_settings() -> Settings:
    settings = Settings(
        # BookmarkingSitesSheetId=os.getenv("BookmarkingSitesSheetId", "").strip("'\""),
        BookmarkingSitesSheetId=BookmarkingSitesSheetId,
        # BookmarkingSitesSheetName=os.getenv(
        #     "BookmarkingSitesSheetName", "Sheet1"
        # ).strip("'\""),
        BookmarkingSitesSheetName=BookmarkingSitesSheetName,
        GOOGLE_SERVICE_ACCOUNT_FILE=PROJECT_ROOT
        / os.getenv(
            "google_service_account_file", "credentials/credentials.json"
        ).strip("'\""),
        app_name=os.getenv(
            "APP_NAME",
            "WebAgent",
        ),
        app_env=os.getenv(
            "APP_ENV",
            "development",
        ),
        headless=_env_bool(
            "HEADLESS",
            False,
        ),
        slow_mo=_env_int(
            "SLOW_MO",
            100,
        ),
        default_timeout=_env_int(  # noqa: F821
            "DEFAULT_TIMEOUT",
            10_000,
        ),
        navigation_timeout=_env_int(
            "NAVIGATION_TIMEOUT",
            30_000,
        ),
        ignore_https_errors=_env_bool(
            "IGNORE_HTTPS_ERRORS",
            True,
        ),
        browser_channel=os.getenv(
            "BROWSER_CHANNEL",
            "chrome",
        ),
        browser_profile_dir=PROJECT_ROOT
        / os.getenv(
            "BROWSER_PROFILE_DIR",
            "data/browser_profiles/web_agent",
        ),
        start_url=os.getenv(
            "START_URL",
            "https://www.google.com",
        ),
        current_record_path=PROJECT_ROOT
        / os.getenv(
            "CURRENT_RECORD_PATH",
            "data/current_record.json",
        ),
        use_ai_fallback=_env_bool(
            "USE_AI_FALLBACK",
            True,
        ),
        # groq_api_key=os.getenv("GROQ_API_KEY"),
        groq_api_key=GROQ_API_KEY,
        # groq_model=os.getenv(
        #     "GROQ_MODEL",
        #     "llama-3.3-70b-versatile",
        # ),
        groq_model=GROQ_MODEL,
        default_category=os.getenv(
            "DEFAULT_CATEGORY",
            "Business",
        ),
        browser_mode=os.getenv(
            "BROWSER_MODE",
            "cdp",
        )
        .strip()
        .lower(),
        cdp_url=os.getenv(
            "CDP_URL",
            "http://127.0.0.1:9222",
        ),
    )

    return settings


settings = get_settings()
