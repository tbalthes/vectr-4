from fastapi import APIRouter
from core.matching import categorize_transaction

router = APIRouter()

@router.post("/")
def categorize_endpoint(transaction: dict):
    result = categorize_transaction(transaction)
    return result