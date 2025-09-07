from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
import re

router = APIRouter(prefix="/normalize", tags=["normalize"])

class DescriptionRequest(BaseModel):
    descriptions: List[str]

class CleanedDescription(BaseModel):
    original: str
    cleaned: str

class DescriptionResponse(BaseModel):
    cleaned_descriptions: List[CleanedDescription]

def _clean_and_normalize_description(memo: str) -> str:
    """
    Performs initial cleaning on the transaction memo text.
    Returns lowercase cleaned description for consistency.
    """
    if not isinstance(memo, str):
        return ""
    
    # Convert to lowercase for consistent matching
    text = memo.lower()
    
    # Remove special characters, but keep alphanumeric, spaces, and some separators
    text = re.sub(r'[^a-z0-9\s#\-\.]', '', text)
    
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    
    # Remove MCC codes and other known patterns
    text = re.sub(r'\bmc[c]?\s*\d{4}\b', '', text)
    text = re.sub(r'\b\d{1,2}/\d{1,2}/\d{2,4}\b', '', text)  # Dates
    text = re.sub(r'\b\d{10,}\b', '', text)  # Long transaction IDs
    text = re.sub(r'#\d+', '', text).strip()  # Store numbers
    
    # Remove common noise words
    noise = [
        'debit card', 'withdrawal', 'deposit', 'phoenix', 'az', 'ar', 'date', 
        'type', 'payments', 'ach', 'ecc', 'ppd', 'web', 'trace', 'ref', 'mcc'
    ]
    
    # Dynamically build a regex to remove whole words
    noise_regex = r'\b(' + '|'.join(noise) + r')\b'
    text = re.sub(noise_regex, '', text)
    
    # Collapse extra whitespace that may have been created
    return re.sub(r'\s+', ' ', text).strip()

@router.post("/descriptions", response_model=DescriptionResponse)
def normalize_descriptions(request: DescriptionRequest):
    """
    Normalize and clean transaction descriptions.
    Returns lowercase cleaned descriptions ready for matching.
    """
    cleaned_descriptions = []
    
    for description in request.descriptions:
        cleaned = _clean_and_normalize_description(description)
        cleaned_descriptions.append(CleanedDescription(
            original=description,
            cleaned=cleaned
        ))
    
    return DescriptionResponse(cleaned_descriptions=cleaned_descriptions)
