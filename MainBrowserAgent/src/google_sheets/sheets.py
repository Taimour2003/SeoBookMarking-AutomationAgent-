import os
import gspread
from google.oauth2.service_account import Credentials

from dotenv import load_dotenv, set_key

load_dotenv()

# 1. Pehle .env file ka path set karein
env_path = ".env"


# 1. Scopes define karein
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

# 2. Service account JSON file ka path
# CREDENTIALS_FILE = "credentials.json"  # Apni JSON file ka naam likhein
CREDENTIALS_FILE = os.getenv("google_service_account_file")

print(f"Using credentials file: {CREDENTIALS_FILE}")


def connect_to_sheet(sheet_name: str):
    """Google Sheet se connect hone ka function."""
    creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=SCOPES)
    client = gspread.authorize(creds)

    # Sheet ko name se open karein
    sheet = client.open(sheet_name)
    print(f"Connected to Google Sheet: {sheet}")
    # 2. Variable ko update karein (Yeh .env file ke andar ja kar change kar dega)
    # Syntax: set_key(file_path, key_name, new_value)
    set_key(env_path, "GOOGLE_SHEET_ID", sheet.id)
    worksheet = sheet.worksheet("Keywords Sheet")
    return worksheet

