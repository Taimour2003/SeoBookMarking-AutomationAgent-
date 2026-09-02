from __future__ import annotations

import hashlib
import json
import os
import subprocess
import urllib.request
from pathlib import Path


APP_NAME = "WebAgent"

# Replace these with your actual GitHub repo values
GITHUB_OWNER = "https://github.com/Taimour2003"
GITHUB_REPO = "SeoBookMarking-AutomationAgent-"

VERSION_URL = (
    f"https://github.com/{GITHUB_OWNER}/{GITHUB_REPO}/"
    "releases/latest/download/version.json"
)


def get_app_dir() -> Path:
    local_app_data = os.environ.get("LOCALAPPDATA")

    if not local_app_data:
        raise RuntimeError("LOCALAPPDATA environment variable not found.")

    app_dir = Path(local_app_data) / APP_NAME

    app_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    return app_dir


APP_DIR = get_app_dir()

APP_EXE = APP_DIR / "WebAgent-App.exe"

LOCAL_VERSION_FILE = APP_DIR / "version.txt"


def get_local_version() -> str | None:
    if not LOCAL_VERSION_FILE.exists():
        return None

    try:
        return LOCAL_VERSION_FILE.read_text(encoding="utf-8").strip()

    except Exception:
        return None


def get_latest_info() -> dict:
    print("[LAUNCHER] Checking for updates...")

    request = urllib.request.Request(
        VERSION_URL,
        headers={"User-Agent": "WebAgent-Updater"},
    )

    with urllib.request.urlopen(
        request,
        timeout=15,
    ) as response:
        raw_data = response.read()

    data = json.loads(raw_data.decode("utf-8"))

    required_fields = {
        "version",
        "download_url",
        "sha256",
    }

    missing = required_fields - set(data.keys())

    if missing:
        raise RuntimeError(f"Invalid version.json. Missing: {missing}")

    return data


def calculate_sha256(
    file_path: Path,
) -> str:

    sha256 = hashlib.sha256()

    with file_path.open("rb") as file:
        while True:
            chunk = file.read(1024 * 1024)

            if not chunk:
                break

            sha256.update(chunk)

    return sha256.hexdigest()


def download_file(
    url: str,
    destination: Path,
) -> None:

    print("[UPDATE] Downloading latest WebAgent...")

    request = urllib.request.Request(
        url,
        headers={"User-Agent": "WebAgent-Updater"},
    )

    with urllib.request.urlopen(
        request,
        timeout=120,
    ) as response:
        with destination.open("wb") as output:
            while True:
                chunk = response.read(1024 * 1024)

                if not chunk:
                    break

                output.write(chunk)


def install_update(
    latest_info: dict,
) -> None:

    temp_file = APP_DIR / "WebAgent-App.new.exe"

    old_file = APP_DIR / "WebAgent-App.old.exe"

    temp_file.unlink(missing_ok=True)

    download_file(
        latest_info["download_url"],
        temp_file,
    )

    print("[UPDATE] Verifying download...")

    expected_hash = latest_info["sha256"].strip().lower()

    actual_hash = calculate_sha256(temp_file).lower()

    if expected_hash != actual_hash:
        temp_file.unlink(missing_ok=True)

        raise RuntimeError("SHA256 verification failed. Downloaded update rejected.")

    old_file.unlink(missing_ok=True)

    if APP_EXE.exists():
        APP_EXE.rename(old_file)

    try:
        temp_file.rename(APP_EXE)

    except Exception:
        if old_file.exists():
            old_file.rename(APP_EXE)

        raise

    LOCAL_VERSION_FILE.write_text(
        latest_info["version"],
        encoding="utf-8",
    )

    print(
        "[UPDATE] Installed version:",
        latest_info["version"],
    )


def start_webagent() -> None:

    if not APP_EXE.exists():
        raise RuntimeError("WebAgent-App.exe is not installed.")

    print("[LAUNCHER] Starting WebAgent...")

    subprocess.Popen(
        [str(APP_EXE)],
        cwd=str(APP_DIR),
    )


def main() -> None:

    print("==============================")

    print("       WebAgent Launcher")

    print("==============================")

    local_version = get_local_version()

    try:
        latest_info = get_latest_info()

        latest_version = str(latest_info["version"]).strip()

        print(
            "[VERSION] Local :",
            local_version or "Not installed",
        )

        print(
            "[VERSION] Latest:",
            latest_version,
        )

        if not APP_EXE.exists() or local_version != latest_version:
            print("[UPDATE] New version found.")

            install_update(latest_info)

        else:
            print("[UPDATE] WebAgent is up to date.")

    except Exception as error:
        print(
            "[UPDATE WARNING]",
            error,
        )

        if not APP_EXE.exists():
            print("[ERROR] No local WebAgent installation available.")

            input("Press Enter to exit...")

            return

        print("[OFFLINE] Starting installed version.")

    try:
        start_webagent()

    except Exception as error:
        print(
            "[START ERROR]",
            error,
        )

        input("Press Enter to exit...")


if __name__ == "__main__":
    main()
