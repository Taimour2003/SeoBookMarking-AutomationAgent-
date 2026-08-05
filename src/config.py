from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


# Project root:
# WebAgent/
# ├── .env
# ├── data/
# └── src/
#     └── config.py
PROJECT_ROOT = Path(__file__).resolve().parent.parent

ENV_FILE = PROJECT_ROOT / ".env"

load_dotenv(
    dotenv_path=ENV_FILE,
    override=False,
)


def get_bool_env(
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


def get_int_env(
    key: str,
    default: int,
) -> int:
    value = os.getenv(key)

    if value is None:
        return default

    try:
        return int(value)
    except ValueError as error:
        raise ValueError(
            f"Environment variable {key} "
            f"must be an integer. Received: {value}"
        ) from error


@dataclass(frozen=True)
class Settings:
    # Application
    app_name: str
    app_env: str

    # Browser
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

    # Runtime directories
    screenshot_dir: Path
    session_dir: Path
    log_dir: Path
    database_dir: Path

    # AI fallback
    use_ai_fallback: bool
    groq_api_key: str | None
    groq_model: str

    # Default form values
    default_category: str
    
    browser_mode:str
    cdp_url:str

    def ensure_directories(self) -> None:
        directories = [
            self.browser_profile_dir,
            self.screenshot_dir,
            self.session_dir,
            self.log_dir,
            self.database_dir,
            self.current_record_path.parent,
        ]

        for directory in directories:
            directory.mkdir(
                parents=True,
                exist_ok=True,
            )


def get_settings() -> Settings:
    settings = Settings(
        app_name=os.getenv(
            "APP_NAME",
            "WebAgent",
        ),
        app_env=os.getenv(
            "APP_ENV",
            "development",
        ),

        headless=get_bool_env(
            "HEADLESS",
            False,
        ),
        slow_mo=get_int_env(
            "SLOW_MO",
            100,
        ),
        default_timeout=get_int_env(
            "DEFAULT_TIMEOUT",
            10_000,
        ),
        navigation_timeout=get_int_env(
            "NAVIGATION_TIMEOUT",
            30_000,
        ),
        ignore_https_errors=get_bool_env(
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

        screenshot_dir=PROJECT_ROOT
        / os.getenv(
            "SCREENSHOT_DIR",
            "screenshots",
        ),
        session_dir=PROJECT_ROOT
        / os.getenv(
            "SESSION_DIR",
            "data/sessions",
        ),
        log_dir=PROJECT_ROOT
        / os.getenv(
            "LOG_DIR",
            "logs",
        ),
        database_dir=PROJECT_ROOT
        / os.getenv(
            "DATABASE_DIR",
            "database",
        ),

        use_ai_fallback=get_bool_env(
            "USE_AI_FALLBACK",
            True,
        ),
        groq_api_key=os.getenv(
            "GROQ_API_KEY"
        ),
        groq_model=os.getenv(
            "GROQ_MODEL",
            "llama-3.3-70b-versatile",
        ),

        default_category=os.getenv(
            "DEFAULT_CATEGORY",
            "Business",
        ),
        
        browser_mode=os.getenv(
            "BROWSER_MODE",
            "cdp",
        ).strip().lower(),
        
        cdp_url=os.getenv(
            "CDP_URL",
            "ws://localhost:9222/devtools/browser",
        ),
    )

    settings.ensure_directories()

    return settings


settings = get_settings()