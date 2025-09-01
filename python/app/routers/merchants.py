"""
Merchants Router - Read-only access to merchant lookup data.
Provides search and retrieval functionality for the merchant lookup table.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
import uuid
from typing import List, Optional
from pydantic import BaseModel

from ..dependencies import get_data_cache


router = APIRouter(
    prefix="/merchants",
    tags=["merchants"],
)


class MerchantResponse(BaseModel):
    """Response model for merchant data."""
    id: str
    name: str
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    logo_url: Optional[str] = None
    aliases: Optional[List[str]] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class MerchantSearchResponse(BaseModel):
    """Response model for merchant search results."""
    merchants: List[MerchantResponse]
    total_count: int
    has_more: bool


@router.get("/search", response_model=MerchantSearchResponse)
def search_merchants(
    q: str = Query(..., description="Search query for merchant names"),
    category_id: Optional[str] = Query(None, description="Category ID to filter by"),
    limit: int = Query(default=50, le=100, description="Maximum number of results"),
    offset: int = Query(default=0, ge=0, description="Number of results to skip"),
    data_cache=Depends(get_data_cache),
):
    """
    Search for merchants by name.
    
    This endpoint:
    - Searches merchants by name (case-insensitive, partial matching)
    - Optionally filters by category_id 
    - Supports pagination with limit/offset
    - Returns merchants with category information
    """
    try:
        # Validate category_id format if provided
        if category_id:
            try:
                uuid.UUID(category_id)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid category_id format")
        
        # Get all merchants from cache
        all_merchants = data_cache.merchants or []
        
        # Filter merchants by search query
        search_query = q.lower().strip()
        if not search_query:
            raise HTTPException(status_code=400, detail="Search query cannot be empty")
        
        matching_merchants = []
        for merchant in all_merchants:
            merchant_name = merchant.get('name', '').lower()
            
            # Check if merchant name contains the search query
            if search_query not in merchant_name:
                continue
            
            # Filter by category_id if provided
            if category_id and str(merchant.get('default_category_id', '')) != category_id:
                continue
            
            # Get category name if available
            category_name = None
            if merchant.get('default_category_id'):
                category = data_cache.get_category_by_id(merchant.get('default_category_id'))
                if category:
                    category_name = category.get('name')
            
            matching_merchants.append(MerchantResponse(
                id=str(merchant['id']),
                name=merchant.get('name', ''),
                category_id=str(merchant.get('default_category_id')) if merchant.get('default_category_id') else None,
                category_name=category_name,
                logo_url=merchant.get('logo_url'),
                aliases=merchant.get('aliases'),
                created_at=merchant.get('created_at'),
                updated_at=merchant.get('updated_at')
            ))
        
        # Sort by name for consistent results
        matching_merchants.sort(key=lambda x: x.name.lower())
        
        # Apply pagination
        total_count = len(matching_merchants)
        paginated_merchants = matching_merchants[offset:offset + limit]
        has_more = offset + limit < total_count
        
        return MerchantSearchResponse(
            merchants=paginated_merchants,
            total_count=total_count,
            has_more=has_more
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to search merchants: {str(e)}"
        )


@router.get("/{merchant_id}", response_model=MerchantResponse)
def get_merchant(
    merchant_id: str,
    data_cache=Depends(get_data_cache),
):
    """
    Get a specific merchant by ID.
    
    Returns merchant details with category information if available.
    """
    try:
        # Validate merchant_id format
        try:
            uuid.UUID(merchant_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid merchant_id format")
        
        # Find merchant in cache
        merchant = data_cache.get_merchant_by_id(merchant_id)
        if not merchant:
            raise HTTPException(status_code=404, detail="Merchant not found")
        
        # Get category name if available
        category_name = None
        if merchant.get('default_category_id'):
            category = data_cache.get_category_by_id(merchant.get('default_category_id'))
            if category:
                category_name = category.get('name')
        
        return MerchantResponse(
            id=str(merchant['id']),
            name=merchant.get('name', ''),
            category_id=str(merchant.get('default_category_id')) if merchant.get('default_category_id') else None,
            category_name=category_name,
            logo_url=merchant.get('logo_url'),
            aliases=merchant.get('aliases'),
            created_at=merchant.get('created_at'),
            updated_at=merchant.get('updated_at')
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get merchant: {str(e)}"
        )
