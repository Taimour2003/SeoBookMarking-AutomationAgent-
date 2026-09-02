import json
import os

from data_source.data_navigator import DataNavigator
from data_source.data_parser import parse_sheet_entries

from google_sheets.client_excel_sheet_data_getter import get_data_from_uploaded_file

SESSION_FILE="saved_session_data.json"
def save_session_data(signup_data:dict,parsed_entries:list):
    
    try:
        payload={
            "signup_data": signup_data,
            "parsed_entries": parsed_entries
        }
        with open(SESSION_FILE, "w", encoding="utf-8") as f:
            json.dump(payload, f,indent=4,default=str)
    except Exception as e:
        print("Error saving session data:", str(e))
        

def load_session_data() ->tuple[dict,list]:
    if os.path.exists(SESSION_FILE):
        try:
            with open(SESSION_FILE, "r", encoding="utf-8") as f:
                payload = json.load(f)
                print("Session data loaded successfully.")
                return payload.get("signup_data", {}), payload.get("parsed_entries", [])
        except Exception as e:
            print("Error loading session data:", str(e))
        
    return {}, []  # Return empty dict and list if no session data is found or an error occurs
    
CURRENT_NAVIGATOR = None
CURRENT_SIGNUP_DATA = {}

async def load_sheet_navigator(force_reload: bool = False):
    global CURRENT_NAVIGATOR, CURRENT_SIGNUP_DATA
    
    # 1. Agar force_reload False hai aur pehle se saved file hai, toh disk se load karein
    if not force_reload:
        saved_signup, saved_entries = load_session_data()
        if saved_entries:
            CURRENT_NAVIGATOR = DataNavigator(saved_entries)
            CURRENT_SIGNUP_DATA = saved_signup
            print("[RESTORED] Loaded data from local file storage.")
            return CURRENT_NAVIGATOR, CURRENT_SIGNUP_DATA

    # 2. Fresh Sheet Load Operation
    print("[SHEET] Fetching fresh data from Google Sheet/Excel...")
    sheet_data = get_data_from_uploaded_file()
    parsed_entries = parse_sheet_entries(sheet_data)
    
    if not parsed_entries:
        raise RuntimeError("No valid entries found in the Google Sheet.")

    data_navigator = DataNavigator(parsed_entries)
    current_data = data_navigator.current_data()
    
    target_keys = [
        "username",
        "email",
        "password",
        "confirm_password",
        "first_name",
        "last_name",
    ]
    
    signup_data = {
        key: current_data.get(key, "")
        for key in target_keys
        if current_data.get(key)
    }
    
    if "password" in signup_data and "confirm_password" not in signup_data:
        signup_data["confirm_password"] = signup_data["password"]

    # 3. Global State + Local Disk Storage
    CURRENT_NAVIGATOR = data_navigator
    CURRENT_SIGNUP_DATA = signup_data
    
    # Dono ko File mein Save karein
    save_session_data(signup_data, parsed_entries)
    
    return CURRENT_NAVIGATOR, CURRENT_SIGNUP_DATA