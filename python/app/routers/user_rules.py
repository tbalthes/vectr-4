"""
User Rules Router - Management of user-defined categorization rules.
Includes rule preview functionality to test rules against recent transactions.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
import uuid
import re
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime, timedelta

from ..dependencies import get_supabase_client, get_data_cache
from core.transaction_processor import _match_by_user_rules


router = APIRouter(
    prefix="/user_rules",
    tags=["user_rules"],
)


class UserRuleCreate(BaseModel):
    """Model for creating a new user rule."""
    user_id: str
    match_field: str = Field(..., description="Field to match on: description, clean_description, merchant_name, original_description, amount")
    match_operator: str = Field(..., description="Operator: equals, contains, startswith, endswith, regex")
    match_value: str = Field(..., description="Value to match against")
    category_id: str = Field(..., description="Category to assign when rule matches")
    priority: int = Field(default=100, description="Priority (lower number = higher precedence)")
    enabled: bool = Field(default=True, description="Whether rule is active")
    amount_min: Optional[float] = Field(default=None, description="Minimum amount filter")
    amount_max: Optional[float] = Field(default=None, description="Maximum amount filter") 
    date_from: Optional[str] = Field(default=None, description="Start date filter (YYYY-MM-DD)")
    date_to: Optional[str] = Field(default=None, description="End date filter (YYYY-MM-DD)")
    description: Optional[str] = Field(default=None, description="Human readable description of rule")


class UserRulePreview(BaseModel):
    """Model for rule preview request - same as create but without user_id and enabled defaults to True."""
    match_field: str
    match_operator: str  
    match_value: str
    category_id: str
    priority: int = Field(default=100)
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    description: Optional[str] = None


class UserRuleUpdate(BaseModel):
    """Model for updating an existing user rule."""
    match_field: Optional[str] = None
    match_operator: Optional[str] = None
    match_value: Optional[str] = None
    category_id: Optional[str] = None
    priority: Optional[int] = None
    enabled: Optional[bool] = None
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    description: Optional[str] = None


class UserRuleResponse(BaseModel):
    """Model for user rule response."""
    id: str
    user_id: str
    match_field: str
    match_operator: str
    match_value: str
    category_id: str
    priority: int
    enabled: bool
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class UserRulesListResponse(BaseModel):
    """Response model for user rules list."""
    rules: List[UserRuleResponse]
    total: int
    page: int
    page_size: int


class TransactionMatch(BaseModel):
    """Model for transaction that matched a rule in preview."""
    transaction_id: str
    date: str
    description: str
    clean_description: Optional[str] = None
    merchant_name: Optional[str] = None
    amount: float
    current_category_name: Optional[str] = None
    matched_category_name: Optional[str] = None
    confidence: float
    match_method: str


class RuleReorderRequest(BaseModel):
    """Model for reordering user rules."""
    user_id: str
    order: List[Dict[str, Any]]  # [{"id": "rule_id", "priority": 10}, ...]


class RetroactiveApplyRequest(BaseModel):
    """Model for applying rules retroactively."""
    user_id: str
    rule_ids: Optional[List[str]] = None  # If None, apply all enabled rules
    apply_all: bool = Field(default=False, description="Apply all enabled rules")
    dry_run: bool = Field(default=True, description="If true, return preview without applying")
    limit: int = Field(default=5000, description="Maximum transactions to process")
    date_range: Optional[Dict[str, str]] = None  # {"from": "2024-01-01", "to": "2024-12-31"}


class RetroactiveApplyResponse(BaseModel):
    """Response model for retroactive rule application."""
    processed_count: int
    matched_count: int
    updated_count: int  # Only if not dry_run
    rule_matches: Dict[str, int]  # rule_id -> match_count
    sample_matches: List[TransactionMatch]
    dry_run: bool


class RulePreviewResponse(BaseModel):
    """Response model for rule preview."""
    rule_summary: str
    total_transactions_checked: int
    matching_transactions: List[TransactionMatch]
    would_override_count: int  # How many would change from current category
    sample_limit_reached: bool


class CategoryNode(BaseModel):
    """Model for a category in the tree structure."""
    id: str
    name: str
    parent_id: Optional[str] = None
    children: List['CategoryNode'] = Field(default_factory=list)
    transaction_count: Optional[int] = None  # Optional: count of transactions in this category
    is_user_created: bool = False  # Whether this is a user-created custom category


# Enable forward references for CategoryNode
CategoryNode.model_rebuild()


class CategoriesTreeResponse(BaseModel):
    """Response model for categories tree."""
    categories: List[CategoryNode]
    total_categories: int
    max_depth: int


@router.post("/preview", response_model=RulePreviewResponse)
def preview_rule(
    user_id: str,
    rule: UserRulePreview,
    sample_limit: int = Query(default=100, description="Maximum number of recent transactions to test against"),
    supabase=Depends(get_supabase_client),
    data_cache=Depends(get_data_cache),
):
    """
    Preview how a rule would perform against recent user transactions.
    
    This endpoint:
    - Fetches recent transactions for the user (limited by sample_limit)
    - Tests the proposed rule against each transaction
    - Returns matching transactions with details about what would change
    - Shows rule summary and statistics
    """
    # Validate user_id format
    try:
        uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format")
    
    # Validate category_id format
    try:
        uuid.UUID(rule.category_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid category_id format")
    
    # Validate rule operators
    valid_operators = ["equals", "contains", "startswith", "endswith", "regex"]
    if rule.match_operator not in valid_operators:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid match_operator. Must be one of: {', '.join(valid_operators)}"
        )
    
    # Validate rule fields
    valid_fields = ["description", "clean_description", "merchant_name", "original_description", "amount"]
    if rule.match_field not in valid_fields:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid match_field. Must be one of: {', '.join(valid_fields)}"
        )
    
    # Test regex validity if using regex operator
    if rule.match_operator == "regex":
        try:
            re.compile(rule.match_value)
        except re.error as e:
            raise HTTPException(status_code=400, detail=f"Invalid regex pattern: {e}")
    
    # Fetch recent transactions for this user (limited sample)
    try:
        tx_response = supabase.table("transactions").select(
            "id, date, description, clean_description, merchant_id, amount, primary_category_id, original_description"
        ).eq("user_id", user_id).order("date", desc=True).limit(sample_limit).execute()
        
        if getattr(tx_response, "error", None):
            raise HTTPException(status_code=500, detail=f"Failed to fetch transactions: {tx_response.error}")
            
        transactions = getattr(tx_response, "data", [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    
    # Get category and merchant names for enrichment
    categories_map = {str(cat.get('id')): cat.get('name') for cat in data_cache.categories}
    merchants_map = {str(merchant.get('id')): merchant.get('name') for merchant in data_cache.merchants}
    
    # Convert rule to format expected by _match_by_user_rules
    test_rule = {
        "match_field": rule.match_field,
        "match_operator": rule.match_operator,
        "match_value": rule.match_value,
        "category_id": rule.category_id,
        "priority": rule.priority,
        "enabled": True,
        "amount_min": rule.amount_min,
        "amount_max": rule.amount_max,
        "date_from": rule.date_from,
        "date_to": rule.date_to,
    }
    
    # Test rule against each transaction
    matching_transactions = []
    would_override_count = 0
    
    for tx in transactions:
        # Convert transaction to format expected by rule matcher
        tx_data = {
            "description": tx.get("description"),
            "clean_description": tx.get("clean_description"),
            "original_description": tx.get("original_description"),
            "merchant_name": merchants_map.get(str(tx.get("merchant_id", "")), None),
            "amount": tx.get("amount"),
            "date": tx.get("date"),
        }
        
        # Test if rule matches this transaction
        match_result = _match_by_user_rules(tx_data, [test_rule], data_cache.categories)
        
        if match_result:
            # Get current category name
            current_category_name = None
            current_category_id = tx.get("primary_category_id")
            if current_category_id:
                current_category_name = categories_map.get(str(current_category_id))
            
            # Get new category name
            new_category_name = categories_map.get(rule.category_id, "Unknown Category")
            
            # Check if this would be an override (different from current category)
            would_override = str(current_category_id) != str(rule.category_id) if current_category_id else True
            if would_override:
                would_override_count += 1
            
            matching_transactions.append(TransactionMatch(
                transaction_id=str(tx.get("id")),
                date=str(tx.get("date")),
                description=str(tx.get("description", "")),
                clean_description=tx.get("clean_description"),
                merchant_name=tx_data.get("merchant_name"),
                amount=float(tx.get("amount", 0)),
                current_category_name=current_category_name,
                matched_category_name=new_category_name,
                confidence=match_result.get("confidence", 1.0),
                match_method=match_result.get("match_method", "user_rule")
            ))
    
    # Build rule summary
    operator_desc = {
        "equals": "exactly equals",
        "contains": "contains", 
        "startswith": "starts with",
        "endswith": "ends with",
        "regex": "matches pattern"
    }
    
    rule_summary = f"When {rule.match_field} {operator_desc.get(rule.match_operator, rule.match_operator)} '{rule.match_value}'"
    if rule.amount_min is not None or rule.amount_max is not None:
        amount_filter = []
        if rule.amount_min is not None:
            amount_filter.append(f"amount >= ${rule.amount_min:.2f}")
        if rule.amount_max is not None:
            amount_filter.append(f"amount <= ${rule.amount_max:.2f}")
        rule_summary += f" and {' and '.join(amount_filter)}"
    
    rule_summary += f", categorize as '{categories_map.get(rule.category_id, 'Unknown')}'"
    
    return RulePreviewResponse(
        rule_summary=rule_summary,
        total_transactions_checked=len(transactions),
        matching_transactions=matching_transactions,
        would_override_count=would_override_count,
        sample_limit_reached=len(transactions) >= sample_limit
    )


def _validate_rule_fields(rule_data: dict):
    """Validate rule fields and operators."""
    valid_operators = ["equals", "contains", "startswith", "endswith", "regex", "greater_than", "less_than"]
    valid_fields = ["description", "clean_description", "merchant_name", "original_description", "amount"]
    
    if rule_data.get("match_operator") not in valid_operators:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid match_operator. Must be one of: {', '.join(valid_operators)}"
        )
    
    if rule_data.get("match_field") not in valid_fields:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid match_field. Must be one of: {', '.join(valid_fields)}"
        )
    
    # Test regex validity if using regex operator
    if rule_data.get("match_operator") == "regex":
        try:
            re.compile(rule_data.get("match_value", ""))
        except re.error as e:
            raise HTTPException(status_code=400, detail=f"Invalid regex pattern: {e}")


@router.get("", response_model=UserRulesListResponse)
def get_user_rules(
    user_id: str,
    search: Optional[str] = Query(None, description="Search in description, match_field, match_value"),
    enabled: Optional[bool] = Query(None, description="Filter by enabled status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Page size"),
    order_by: str = Query("priority", description="Order by field: priority, created_at, updated_at"),
    order: str = Query("asc", description="Order direction: asc, desc"),
    supabase=Depends(get_supabase_client),
):
    """Get user rules with pagination, search, and filtering."""
    # Validate user_id format
    try:
        uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format")
    
    try:
        # Build query
        query = supabase.table("user_rules").select("*").eq("user_id", user_id)
        
        # Apply filters
        search_filter = None
        if enabled is not None:
            query = query.eq("enabled", enabled)
        
        if search:
            # Search in description, match_field, match_value
            search_filter = f"description.ilike.%{search}%,match_field.ilike.%{search}%,match_value.ilike.%{search}%"
            query = query.or_(search_filter)
        
        # Apply ordering
        desc = order == "desc"
        if order_by in ["priority", "created_at", "updated_at"]:
            query = query.order(order_by, desc=desc)
        else:
            query = query.order("priority", desc=False)
        
        # Get total count
        count_response = supabase.table("user_rules").select("id", count="exact").eq("user_id", user_id)
        if enabled is not None:
            count_response = count_response.eq("enabled", enabled)
        if search_filter:
            count_response = count_response.or_(search_filter)
        
        count_result = count_response.execute()
        total = getattr(count_result, "count", 0) or 0
        
        # Apply pagination
        offset = (page - 1) * page_size
        query = query.range(offset, offset + page_size - 1)
        
        response = query.execute()
        
        if getattr(response, "error", None):
            raise HTTPException(status_code=500, detail=f"Database error: {response.error}")
        
        rules_data = getattr(response, "data", [])
        rules = [UserRuleResponse(**rule) for rule in rules_data]
        
        return UserRulesListResponse(
            rules=rules,
            total=total,
            page=page,
            page_size=page_size
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")


@router.post("", response_model=UserRuleResponse)
def create_user_rule(
    rule: UserRuleCreate,
    supabase=Depends(get_supabase_client),
):
    """Create a new user rule."""
    # Validate user_id format
    try:
        uuid.UUID(rule.user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format")
    
    # Validate category_id format
    try:
        uuid.UUID(rule.category_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid category_id format")
    
    # Validate rule fields
    _validate_rule_fields(rule.dict())
    
    try:
        # If no priority specified, assign next available priority
        if rule.priority is None or rule.priority == 100:
            max_priority_response = supabase.table("user_rules").select("priority").eq("user_id", rule.user_id).order("priority", desc=True).limit(1).execute()
            max_priority_data = getattr(max_priority_response, "data", [])
            max_priority = max_priority_data[0].get("priority", 0) if max_priority_data else 0
            rule.priority = max_priority + 10
        
        # Prepare rule data
        rule_data = rule.dict()
        rule_data["created_at"] = datetime.utcnow().isoformat()
        rule_data["updated_at"] = datetime.utcnow().isoformat()
        
        # Insert rule
        response = supabase.table("user_rules").insert(rule_data).execute()
        
        if getattr(response, "error", None):
            raise HTTPException(status_code=500, detail=f"Failed to create rule: {response.error}")
        
        created_rule = getattr(response, "data", [])[0]
        return UserRuleResponse(**created_rule)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")


@router.put("/{rule_id}", response_model=UserRuleResponse)
def update_user_rule(
    rule_id: str,
    rule_update: UserRuleUpdate,
    user_id: str,
    supabase=Depends(get_supabase_client),
):
    """Update an existing user rule."""
    # Validate user_id format
    try:
        uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format")
    
    # Validate rule_id format
    try:
        uuid.UUID(rule_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid rule_id format")
    
    # Validate category_id if provided
    if rule_update.category_id:
        try:
            uuid.UUID(rule_update.category_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid category_id format")
    
    try:
        # Check if rule exists and belongs to user
        existing_response = supabase.table("user_rules").select("*").eq("id", rule_id).eq("user_id", user_id).execute()
        existing_data = getattr(existing_response, "data", [])
        
        if not existing_data:
            raise HTTPException(status_code=404, detail="Rule not found")
        
        existing_rule = existing_data[0]
        
        # Prepare update data (only fields that are not None)
        update_data = {k: v for k, v in rule_update.dict().items() if v is not None}
        
        if update_data:
            # Validate rule fields if being updated
            merged_rule = {**existing_rule, **update_data}
            _validate_rule_fields(merged_rule)
            
            update_data["updated_at"] = datetime.utcnow().isoformat()
            
            # Update rule
            response = supabase.table("user_rules").update(update_data).eq("id", rule_id).eq("user_id", user_id).execute()
            
            if getattr(response, "error", None):
                raise HTTPException(status_code=500, detail=f"Failed to update rule: {response.error}")
            
            updated_rule = getattr(response, "data", [])[0]
            return UserRuleResponse(**updated_rule)
        else:
            return UserRuleResponse(**existing_rule)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")


@router.delete("/{rule_id}")
def delete_user_rule(
    rule_id: str,
    user_id: str,
    supabase=Depends(get_supabase_client),
):
    """Delete a user rule."""
    # Validate user_id format
    try:
        uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format")
    
    # Validate rule_id format
    try:
        uuid.UUID(rule_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid rule_id format")
    
    try:
        # Check if rule exists and belongs to user
        existing_response = supabase.table("user_rules").select("id").eq("id", rule_id).eq("user_id", user_id).execute()
        existing_data = getattr(existing_response, "data", [])
        
        if not existing_data:
            raise HTTPException(status_code=404, detail="Rule not found")
        
        # Delete rule
        response = supabase.table("user_rules").delete().eq("id", rule_id).eq("user_id", user_id).execute()
        
        if getattr(response, "error", None):
            raise HTTPException(status_code=500, detail=f"Failed to delete rule: {response.error}")
        
        return {"message": "Rule deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")


@router.post("/reorder")
def reorder_user_rules(
    reorder_request: RuleReorderRequest,
    supabase=Depends(get_supabase_client),
):
    """Reorder user rules by updating priorities."""
    # Validate user_id format
    try:
        uuid.UUID(reorder_request.user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format")
    
    try:
        # Validate all rule IDs belong to user
        rule_ids = [item.get("id") for item in reorder_request.order if item.get("id")]
        
        if rule_ids:
            existing_response = supabase.table("user_rules").select("id").eq("user_id", reorder_request.user_id).in_("id", rule_ids).execute()
            existing_data = getattr(existing_response, "data", [])
            existing_ids = {rule["id"] for rule in existing_data}
            
            # Check if all requested rule IDs exist
            requested_ids = set(rule_ids)
            if not requested_ids.issubset(existing_ids):
                missing_ids = requested_ids - existing_ids
                raise HTTPException(status_code=404, detail=f"Rules not found: {list(missing_ids)}")
        
        # Update priorities
        updates_successful = 0
        for item in reorder_request.order:
            rule_id = item.get("id")
            priority = item.get("priority")
            
            if rule_id and priority is not None:
                try:
                    uuid.UUID(rule_id)
                    update_response = supabase.table("user_rules").update({
                        "priority": priority,
                        "updated_at": datetime.utcnow().isoformat()
                    }).eq("id", rule_id).eq("user_id", reorder_request.user_id).execute()
                    
                    if not getattr(update_response, "error", None):
                        updates_successful += 1
                except ValueError:
                    continue  # Skip invalid UUIDs
        
        return {"message": f"Successfully updated {updates_successful} rule priorities"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")


@router.post("/apply-retroactive", response_model=RetroactiveApplyResponse)
def apply_rules_retroactive(
    apply_request: RetroactiveApplyRequest,
    supabase=Depends(get_supabase_client),
    data_cache=Depends(get_data_cache),
):
    """Apply user rules retroactively to existing transactions."""
    # Validate user_id format
    try:
        uuid.UUID(apply_request.user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format")
    
    try:
        # Get rules to apply
        if apply_request.rule_ids:
            # Apply specific rules
            rules_response = supabase.table("user_rules").select("*").eq("user_id", apply_request.user_id).in_("id", apply_request.rule_ids).eq("enabled", True).execute()
        elif apply_request.apply_all:
            # Apply all enabled rules
            rules_response = supabase.table("user_rules").select("*").eq("user_id", apply_request.user_id).eq("enabled", True).order("priority").execute()
        else:
            raise HTTPException(status_code=400, detail="Must specify either rule_ids or apply_all=true")
        
        if getattr(rules_response, "error", None):
            raise HTTPException(status_code=500, detail=f"Failed to fetch rules: {rules_response.error}")
        
        rules_data = getattr(rules_response, "data", [])
        
        if not rules_data:
            return RetroactiveApplyResponse(
                processed_count=0,
                matched_count=0,
                updated_count=0,
                rule_matches={},
                sample_matches=[],
                dry_run=apply_request.dry_run
            )
        
        # Build query for transactions
        tx_query = supabase.table("transactions").select(
            "id, date, description, clean_description, merchant_id, amount, primary_category_id, original_description"
        ).eq("user_id", apply_request.user_id)
        
        # Apply date range filter if specified
        if apply_request.date_range:
            if apply_request.date_range.get("from"):
                tx_query = tx_query.gte("date", apply_request.date_range["from"])
            if apply_request.date_range.get("to"):
                tx_query = tx_query.lte("date", apply_request.date_range["to"])
        
        # Apply limit and get transactions
        tx_query = tx_query.order("date", desc=True).limit(apply_request.limit)
        tx_response = tx_query.execute()
        
        if getattr(tx_response, "error", None):
            raise HTTPException(status_code=500, detail=f"Failed to fetch transactions: {tx_response.error}")
        
        transactions = getattr(tx_response, "data", [])
        
        # Get category and merchant names for enrichment
        categories_map = {str(cat.get('id')): cat.get('name') for cat in data_cache.categories}
        merchants_map = {str(merchant.get('id')): merchant.get('name') for merchant in data_cache.merchants}
        
        # Process transactions
        processed_count = len(transactions)
        matched_count = 0
        updated_count = 0
        rule_matches = {str(rule["id"]): 0 for rule in rules_data}
        sample_matches = []
        
        # Convert rules to format expected by matcher
        matcher_rules = []
        for rule in rules_data:
            matcher_rules.append({
                "id": str(rule["id"]),
                "match_field": rule["match_field"],
                "match_operator": rule["match_operator"],
                "match_value": rule["match_value"],
                "category_id": rule["category_id"],
                "priority": rule["priority"],
                "enabled": rule["enabled"],
                "amount_min": rule.get("amount_min"),
                "amount_max": rule.get("amount_max"),
                "date_from": rule.get("date_from"),
                "date_to": rule.get("date_to"),
            })
        
        transactions_to_update = []
        
        for tx in transactions:
            # Convert transaction to format expected by rule matcher
            tx_data = {
                "description": tx.get("description"),
                "clean_description": tx.get("clean_description"),
                "original_description": tx.get("original_description"),
                "merchant_name": merchants_map.get(str(tx.get("merchant_id", "")), None),
                "amount": tx.get("amount"),
                "date": tx.get("date"),
            }
            
            # Test rules against this transaction
            match_result = _match_by_user_rules(tx_data, matcher_rules, data_cache.categories)
            
            if match_result:
                matched_count += 1
                matched_rule_id = match_result.get("rule_id")
                new_category_id = match_result.get("category_id")
                
                # Track rule matches
                if matched_rule_id and str(matched_rule_id) in rule_matches:
                    rule_matches[str(matched_rule_id)] += 1
                
                # Check if this would change the category
                current_category_id = tx.get("primary_category_id")
                would_update = str(current_category_id) != str(new_category_id) if current_category_id else True
                
                if would_update:
                    transactions_to_update.append({
                        "id": tx["id"],
                        "new_category_id": new_category_id
                    })
                    
                    # Add to sample matches (limit to 20)
                    if len(sample_matches) < 20:
                        current_category_name = categories_map.get(str(current_category_id)) if current_category_id else None
                        new_category_name = categories_map.get(str(new_category_id), "Unknown Category")
                        
                        sample_matches.append(TransactionMatch(
                            transaction_id=str(tx["id"]),
                            date=str(tx["date"]),
                            description=str(tx.get("description", "")),
                            clean_description=tx.get("clean_description"),
                            merchant_name=tx_data.get("merchant_name"),
                            amount=float(tx.get("amount", 0)),
                            current_category_name=current_category_name,
                            matched_category_name=new_category_name,
                            confidence=match_result.get("confidence", 1.0),
                            match_method=match_result.get("match_method", "user_rule")
                        ))
        
        # If not dry run, apply the updates
        if not apply_request.dry_run and transactions_to_update:
            for tx_update in transactions_to_update:
                try:
                    update_response = supabase.table("transactions").update({
                        "primary_category_id": tx_update["new_category_id"],
                        "needs_review": False,  # Mark as reviewed since rule applied
                        "updated_at": datetime.utcnow().isoformat()
                    }).eq("id", tx_update["id"]).eq("user_id", apply_request.user_id).execute()
                    
                    if not getattr(update_response, "error", None):
                        updated_count += 1
                except Exception as e:
                    print(f"Failed to update transaction {tx_update['id']}: {e}")
                    continue
        
        return RetroactiveApplyResponse(
            processed_count=processed_count,
            matched_count=matched_count,
            updated_count=updated_count if not apply_request.dry_run else 0,
            rule_matches=rule_matches,
            sample_matches=sample_matches,
            dry_run=apply_request.dry_run
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")


def _build_category_tree(categories: List[dict], include_counts: bool = False) -> List["CategoryNode"]:
    """Build a hierarchical tree structure from flat category list."""
    category_map = {}
    root_categories = []
    
    # First pass: create all nodes
    for category in categories:
        node = CategoryNode(
            id=str(category['id']),
            name=category.get('name', ''),
            parent_id=str(category.get('parent_id')) if category.get('parent_id') else None,
            is_user_created=category.get('is_user_created', False)
        )
        
        # Add transaction count if requested
        if include_counts:
            node.transaction_count = category.get('transaction_count', 0)
        
        category_map[str(category['id'])] = node
    
    # Second pass: build parent-child relationships
    for category in categories:
        node = category_map[str(category['id'])]
        parent_id = category.get('parent_id')
        
        if parent_id and str(parent_id) in category_map:
            # Add to parent's children
            category_map[str(parent_id)].children.append(node)
        else:
            # This is a root category
            root_categories.append(node)
    
    # Sort categories and their children by name
    def sort_tree(nodes):
        nodes.sort(key=lambda x: x.name.lower())
        for node in nodes:
            if node.children:
                sort_tree(node.children)
    
    sort_tree(root_categories)
    return root_categories


def _calculate_tree_depth(categories: List["CategoryNode"]) -> int:
    """Calculate the maximum depth of the category tree."""
    max_depth = 0
    
    def calculate_depth(nodes, current_depth=1):
        nonlocal max_depth
        max_depth = max(max_depth, current_depth)
        
        for node in nodes:
            if node.children:
                calculate_depth(node.children, current_depth + 1)
    
    if categories:
        calculate_depth(categories)
    
    return max_depth


@router.get("/categories/tree", response_model=CategoriesTreeResponse)
def get_categories_tree(
    include_counts: bool = Query(default=False, description="Include transaction counts for each category"),
    data_cache=Depends(get_data_cache),
    supabase=Depends(get_supabase_client),
):
    """
    Get all categories in a hierarchical tree structure.
    
    This endpoint:
    - Returns categories organized in a parent-child tree structure
    - Optionally includes transaction counts per category
    - Sorts categories alphabetically within each level
    - Provides tree metadata (total categories, max depth)
    """
    try:
        # Get all categories from data cache
        categories = data_cache.categories or []
        
        # If counts are requested, fetch transaction counts per category
        if include_counts:
            try:
                # Query to get transaction counts per category
                response = supabase.rpc(
                    'aggregate_time_series',
                    {
                        'columns': ['primary_category_id'],
                        'aggregations': ['count'],
                        'group_by': ['primary_category_id'],
                        'time_granularity': 'all'
                    }
                ).execute()
                
                # Create a map of category_id -> transaction_count
                count_map = {}
                if hasattr(response, 'data') and response.data:
                    for row in response.data:
                        category_id = row.get('primary_category_id')
                        count = row.get('count', 0)
                        if category_id:
                            count_map[str(category_id)] = count
                
                # Add counts to categories
                for category in categories:
                    category_id = str(category.get('id', ''))
                    category['transaction_count'] = count_map.get(category_id, 0)
                    
            except Exception as e:
                # Continue without counts if the query fails
                print(f"Warning: Failed to fetch transaction counts: {str(e)}")
                include_counts = False
        
        # Build the tree structure
        tree = _build_category_tree(categories, include_counts)
        max_depth = _calculate_tree_depth(tree)
        
        return CategoriesTreeResponse(
            categories=tree,
            total_categories=len(categories),
            max_depth=max_depth
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch categories tree: {str(e)}")
