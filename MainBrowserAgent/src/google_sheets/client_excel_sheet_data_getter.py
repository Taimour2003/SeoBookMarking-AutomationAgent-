from tkinter import filedialog
from tkinter.tix import Tk

import pandas as pd


def get_data_from_uploaded_file() -> list[list[str]]:
    print("Enter in the get_data_from_uploaded_file function")
    root = Tk()
    root.withdraw()  # Hide the main window
    root.attributes("-topmost", True)  # Bring the file dialog to the front

    print("Waiting for user to select a file...")
    file_path = filedialog.askopenfilename(
        title="Select Excel or CSV sheet file",
        filetypes=[("Excel/CSV Files", "*.xlsx *.xls *.csv"), ("All files", "*.*")],
    )
    root.destroy()  # Close the Tkinter root window after file selection
    if not file_path:
        raise RuntimeError("No file selected. Please select a valid Excel or CSV file.")

    print(f"File selected: {file_path}")

    if file_path.endswith(".csv"):
        df = pd.read_csv(file_path, header=None)
    else:
        df = pd.read_excel(file_path, header=None)

    df = df.fillna("")  # Replace NaN with empty strings

    return df.astype(
        str
    ).values.tolist()  # Convert DataFrame to list of lists of strings

