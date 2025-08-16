import pandas as pd

REQUIRED_COLUMNS = {"transaction_number", "date", "description", "amount"}

def validate_input_schema(df: pd.DataFrame):
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"CSV is missing required columns: {missing}")
    if not pd.api.types.is_numeric_dtype(df['amount']):
        raise ValueError("Amount column must be numeric.")
    # Optionally: check date parsable, etc.

def preprocess_transactions(filepath: str) -> pd.DataFrame:
    df = pd.read_csv(filepath)
    validate_input_schema(df)
    # Normalize date, etc, as before
    return df