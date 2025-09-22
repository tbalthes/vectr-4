from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from core.merchant_regex_matching import categorize_transaction

router = APIRouter(tags=["categorize"])

class CategorizeRequest(BaseModel):
    date: str = Field(..., description="Transaction date (YYYY-MM-DD)")
    transaction_number: str = Field(..., description="Unique transaction number")
    description: str = Field(..., description="Transaction description/memo")
    amount: float = Field(..., description="Transaction amount")
    balance: Optional[float] = Field(None, description="Bank-provided balance (optional)")
    # Add more fields as needed

class CategorizeResponse(BaseModel):
    merchant_id: Optional[str] = Field(None, description="Matched merchant ID")
    merchant_name: Optional[str] = Field(None, description="Matched merchant name")
    category_id: Optional[str] = Field(None, description="Matched category ID")
    category_name: Optional[str] = Field(None, description="Matched category name")
    confidence: Optional[float] = Field(None, description="Confidence score (0-1)")
    match_method: Optional[str] = Field(None, description="Match method used")
    clean_description: Optional[str] = Field(None, description="Parsed/cleaned merchant name")
    needs_review: Optional[bool] = Field(None, description="Flag if transaction needs review")
    # Add more enrichment fields as needed
    original_description: Optional[str] = Field(None, description="Original description from input")
    user_metadata: Optional[Dict[str, Any]] = Field(None, description="Any extra fields from input")

@router.post(
    "/",
    response_model=CategorizeResponse,
    summary="Categorize a single transaction",
    description="""
    Categorizes a single transaction using cleaning, regex, MCC, and other logic. Returns enrichment fields and match details.
    """
)
def categorize_endpoint(transaction: CategorizeRequest):
    """
    Categorizes a single transaction and returns enrichment fields.
    """
    result = categorize_transaction(transaction.dict())
    return result