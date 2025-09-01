"""
Enhanced User Rules Router - Supports complex AND/OR conditions like Monarch Money
Provides user-friendly interface for creating sophisticated transaction rules.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
import uuid
import json
from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, Field, validator
from datetime import datetime, timedelta

from ..dependencies import get_supabase_client, get_data_cache


router = APIRouter(
    prefix="/user_rules_v2",
    tags=["user_rules_v2"],
)


# =============================================
# ENHANCED PYDANTIC MODELS
# =============================================

class RuleCondition(BaseModel):
    """Single condition within a rule."""
    field: str = Field(..., description="Field to match: description, merchant, amount")
    operator: str = Field(..., description="Operator: equals, contains, starts_with, ends_with, greater_than, less_than")
    value: Union[str, int, float] = Field(..., description="Value to match against")
    case_sensitive: bool = Field(default=False, description="Whether text matching is case sensitive")
    
    @validator('field')
    def validate_field(cls, v):
        allowed_fields = ['description', 'merchant', 'amount']
        if v not in allowed_fields:
            raise ValueError(f'Field must be one of: {allowed_fields}')
        return v
    
    @validator('operator')
    def validate_operator(cls, v):
        allowed_operators = ['equals', 'contains', 'starts_with', 'ends_with', 'greater_than', 'less_than']
        if v not in allowed_operators:
            raise ValueError(f'Operator must be one of: {allowed_operators}')
        return v


class RuleConditionGroup(BaseModel):
    """Group of conditions with AND/OR operator."""
    operator: str = Field(..., description="Group operator: AND or OR")
    conditions: List[RuleCondition] = Field(..., description="List of conditions in this group")
    
    @validator('operator')
    def validate_operator(cls, v):
        if v not in ['AND', 'OR']:
            raise ValueError('Group operator must be AND or OR')
        return v


class RuleConditions(BaseModel):
    """Complete rule conditions structure supporting complex AND/OR logic."""
    operator: str = Field(..., description="Root operator: AND or OR")
    groups: List[RuleConditionGroup] = Field(..., description="List of condition groups")
    
    @validator('operator')
    def validate_operator(cls, v):
        if v not in ['AND', 'OR']:
            raise ValueError('Root operator must be AND or OR')
        return v


class RuleActions(BaseModel):
    """Actions to perform when rule matches."""
    category_id: Optional[str] = Field(None, description="Category to assign")
    rename_to: Optional[str] = Field(None, description="New description for transaction")
    add_tags: Optional[List[str]] = Field(default_factory=list, description="Tags to add")
    hide_transaction: bool = Field(default=False, description="Hide from main transaction view")
    needs_review: Optional[bool] = Field(None, description="Override needs_review flag")
    confidence_override: Optional[float] = Field(None, description="Override confidence score")


class EnhancedUserRuleCreate(BaseModel):
    """Model for creating a new enhanced user rule."""
    user_id: str
    name: str = Field(..., description="User-friendly rule name")
    description: Optional[str] = Field(None, description="Optional longer description")
    enabled: bool = Field(default=True, description="Whether rule is active")
    priority: int = Field(default=100, description="Priority (lower number = higher precedence)")
    conditions: RuleConditions = Field(..., description="Complex rule conditions")
    actions: RuleActions = Field(..., description="Actions to perform when rule matches")


class EnhancedUserRuleUpdate(BaseModel):
    """Model for updating an enhanced user rule."""
    name: Optional[str] = None
    description: Optional[str] = None
    enabled: Optional[bool] = None
    priority: Optional[int] = None
    conditions: Optional[RuleConditions] = None
    actions: Optional[RuleActions] = None


class EnhancedUserRuleResponse(BaseModel):
    """Response model for enhanced user rule."""
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    enabled: bool
    priority: int
    conditions: RuleConditions
    actions: RuleActions
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class EnhancedUserRulesListResponse(BaseModel):
    """Response model for enhanced user rules list."""
    rules: List[EnhancedUserRuleResponse]
    total: int
    page: int
    page_size: int


class TransactionMatch(BaseModel):
    """Transaction that matched a rule in preview."""
    transaction_id: str
    date: str
    description: str
    clean_description: Optional[str] = None
    merchant_name: Optional[str] = None
    amount: float
    current_category_name: Optional[str] = None
    matched_category_name: Optional[str] = None
    confidence: float
    match_method: str = "user_rule_v2"


class RulePreviewRequest(BaseModel):
    """Request model for rule preview."""
    user_id: str
    conditions: RuleConditions
    actions: RuleActions
    limit: int = Field(default=10, description="Max transactions to return in preview")


class RulePreviewResponse(BaseModel):
    """Response model for rule preview."""
    rule_summary: str
    total_transactions_checked: int
    matching_transactions: List[TransactionMatch]
    would_override_count: int
    sample_limit_reached: bool


# =============================================
# HELPER FUNCTIONS
# =============================================

def generate_rule_summary(conditions: RuleConditions, actions: RuleActions) -> str:
    """Generate a human-readable summary of the rule."""
    def format_condition(cond: RuleCondition) -> str:
        field_names = {"description": "description", "merchant": "merchant name", "amount": "amount"}
        field = field_names.get(cond.field, cond.field)
        
        if cond.operator == "equals":
            return f"{field} exactly matches '{cond.value}'"
        elif cond.operator == "contains":
            return f"{field} contains '{cond.value}'"
        elif cond.operator == "starts_with":
            return f"{field} starts with '{cond.value}'"
        elif cond.operator == "ends_with":
            return f"{field} ends with '{cond.value}'"
        elif cond.operator == "greater_than":
            return f"{field} greater than {cond.value}"
        elif cond.operator == "less_than":
            return f"{field} less than {cond.value}"
        else:
            return f"{field} {cond.operator} '{cond.value}'"
    
    def format_group(group: RuleConditionGroup) -> str:
        if len(group.conditions) == 1:
            return format_condition(group.conditions[0])
        else:
            formatted_conditions = [format_condition(c) for c in group.conditions]
            return f"({f' {group.operator} '.join(formatted_conditions)})"
    
    # Format conditions
    if len(conditions.groups) == 1:
        conditions_text = format_group(conditions.groups[0])
    else:
        formatted_groups = [format_group(g) for g in conditions.groups]
        conditions_text = f' {conditions.operator} '.join(formatted_groups)
    
    # Format actions
    actions_parts = []
    if actions.category_id:
        actions_parts.append("recategorize")
    if actions.rename_to:
        actions_parts.append(f"rename to '{actions.rename_to}'")
    if actions.add_tags:
        actions_parts.append(f"add tags: {', '.join(actions.add_tags)}")
    if actions.hide_transaction:
        actions_parts.append("hide transaction")
    
    actions_text = ", ".join(actions_parts) if actions_parts else "categorize"
    
    return f"If {conditions_text} then {actions_text}"


def evaluate_rule_against_transaction(conditions: RuleConditions, transaction: Dict[str, Any]) -> bool:
    """Evaluate rule conditions against a transaction."""
    def evaluate_condition(cond: RuleCondition) -> bool:
        # Get the field value from transaction
        if cond.field == "description":
            value = transaction.get("clean_description") or transaction.get("original_description") or transaction.get("description", "")
        elif cond.field == "merchant":
            value = transaction.get("merchant_name", "")
        elif cond.field == "amount":
            value = transaction.get("amount", 0)
        else:
            value = transaction.get(cond.field, "")
        
        if value is None:
            return False
        
        # Convert to string for text operations
        if cond.field != "amount":
            value = str(value)
            expected = str(cond.value)
            
            if not cond.case_sensitive:
                value = value.lower()
                expected = expected.lower()
            
            if cond.operator == "equals":
                return value == expected
            elif cond.operator == "contains":
                return expected in value
            elif cond.operator == "starts_with":
                return value.startswith(expected)
            elif cond.operator == "ends_with":
                return value.endswith(expected)
        else:
            # Numeric operations
            try:
                value = float(value)
                expected = float(cond.value)
                
                if cond.operator == "greater_than":
                    return value > expected
                elif cond.operator == "less_than":
                    return value < expected
                elif cond.operator == "equals":
                    return value == expected
            except (ValueError, TypeError):
                return False
        
        return False
    
    def evaluate_group(group: RuleConditionGroup) -> bool:
        if group.operator == "OR":
            return any(evaluate_condition(cond) for cond in group.conditions)
        else:  # AND
            return all(evaluate_condition(cond) for cond in group.conditions)
    
    # Evaluate root conditions
    if conditions.operator == "OR":
        return any(evaluate_group(group) for group in conditions.groups)
    else:  # AND
        return all(evaluate_group(group) for group in conditions.groups)


# =============================================
# API ENDPOINTS
# =============================================

@router.get("/", response_model=EnhancedUserRulesListResponse)
async def list_enhanced_user_rules(
    user_id: str = Query(..., description="User ID"),
    search: Optional[str] = Query(None, description="Search in rule names"),
    enabled: Optional[bool] = Query(None, description="Filter by enabled status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    order_by: str = Query("priority", description="Order by field"),
    order: str = Query("asc", description="Sort order: asc or desc"),
    supabase=Depends(get_supabase_client)
):
    """List enhanced user rules with filtering, search, and pagination."""
    try:
        # Validate UUID
        uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format")
    
    # Build query
    query = supabase.table("user_rules_v2").select("*", count="exact").eq("user_id", user_id)
    
    # Apply filters
    if search:
        query = query.or_(f"name.ilike.%{search}%,description.ilike.%{search}%")
    
    if enabled is not None:
        query = query.eq("enabled", enabled)
    
    # Apply ordering
    desc = order.lower() == "desc"
    query = query.order(order_by, desc=desc)
    
    # Apply pagination
    start = (page - 1) * page_size
    end = start + page_size - 1
    
    result = query.range(start, end).execute()
    
    if result.data is None:
        raise HTTPException(status_code=500, detail="Failed to fetch rules")
    
    # Convert to response model
    rules = []
    for rule_data in result.data:
        rule = EnhancedUserRuleResponse(
            id=rule_data["id"],
            user_id=rule_data["user_id"],
            name=rule_data["name"],
            description=rule_data.get("description"),
            enabled=rule_data["enabled"],
            priority=rule_data["priority"],
            conditions=RuleConditions(**rule_data["conditions"]),
            actions=RuleActions(**rule_data["actions"]),
            created_at=rule_data.get("created_at"),
            updated_at=rule_data.get("updated_at")
        )
        rules.append(rule)
    
    return EnhancedUserRulesListResponse(
        rules=rules,
        total=result.count or 0,
        page=page,
        page_size=page_size
    )


@router.post("/", response_model=EnhancedUserRuleResponse)
async def create_enhanced_user_rule(
    rule: EnhancedUserRuleCreate,
    supabase=Depends(get_supabase_client)
):
    """Create a new enhanced user rule."""
    try:
        uuid.UUID(rule.user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format")
    
    # Convert Pydantic models to dict for JSON storage
    rule_data = {
        "user_id": rule.user_id,
        "name": rule.name,
        "description": rule.description,
        "enabled": rule.enabled,
        "priority": rule.priority,
        "conditions": rule.conditions.dict(),
        "actions": rule.actions.dict()
    }
    
    result = supabase.table("user_rules_v2").insert(rule_data).execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create rule")
    
    created_rule = result.data[0]
    
    return EnhancedUserRuleResponse(
        id=created_rule["id"],
        user_id=created_rule["user_id"],
        name=created_rule["name"],
        description=created_rule.get("description"),
        enabled=created_rule["enabled"],
        priority=created_rule["priority"],
        conditions=RuleConditions(**created_rule["conditions"]),
        actions=RuleActions(**created_rule["actions"]),
        created_at=created_rule.get("created_at"),
        updated_at=created_rule.get("updated_at")
    )


@router.get("/{rule_id}", response_model=EnhancedUserRuleResponse)
async def get_enhanced_user_rule(
    rule_id: str,
    user_id: str = Query(..., description="User ID for authorization"),
    supabase=Depends(get_supabase_client)
):
    """Get a specific enhanced user rule."""
    try:
        uuid.UUID(rule_id)
        uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")
    
    result = supabase.table("user_rules_v2").select("*").eq("id", rule_id).eq("user_id", user_id).maybeSingle().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    rule_data = result.data
    
    return EnhancedUserRuleResponse(
        id=rule_data["id"],
        user_id=rule_data["user_id"],
        name=rule_data["name"],
        description=rule_data.get("description"),
        enabled=rule_data["enabled"],
        priority=rule_data["priority"],
        conditions=RuleConditions(**rule_data["conditions"]),
        actions=RuleActions(**rule_data["actions"]),
        created_at=rule_data.get("created_at"),
        updated_at=rule_data.get("updated_at")
    )


@router.put("/{rule_id}", response_model=EnhancedUserRuleResponse)
async def update_enhanced_user_rule(
    rule_id: str,
    rule_update: EnhancedUserRuleUpdate,
    user_id: str = Query(..., description="User ID for authorization"),
    supabase=Depends(get_supabase_client)
):
    """Update an enhanced user rule."""
    try:
        uuid.UUID(rule_id)
        uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")
    
    # Build update data, excluding None values
    update_data = {}
    if rule_update.name is not None:
        update_data["name"] = rule_update.name
    if rule_update.description is not None:
        update_data["description"] = rule_update.description
    if rule_update.enabled is not None:
        update_data["enabled"] = rule_update.enabled
    if rule_update.priority is not None:
        update_data["priority"] = rule_update.priority
    if rule_update.conditions is not None:
        update_data["conditions"] = rule_update.conditions.dict()
    if rule_update.actions is not None:
        update_data["actions"] = rule_update.actions.dict()
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updated_at"] = datetime.utcnow().isoformat()
    
    result = supabase.table("user_rules_v2").update(update_data).eq("id", rule_id).eq("user_id", user_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Rule not found or update failed")
    
    updated_rule = result.data[0]
    
    return EnhancedUserRuleResponse(
        id=updated_rule["id"],
        user_id=updated_rule["user_id"],
        name=updated_rule["name"],
        description=updated_rule.get("description"),
        enabled=updated_rule["enabled"],
        priority=updated_rule["priority"],
        conditions=RuleConditions(**updated_rule["conditions"]),
        actions=RuleActions(**updated_rule["actions"]),
        created_at=updated_rule.get("created_at"),
        updated_at=updated_rule.get("updated_at")
    )


@router.delete("/{rule_id}")
async def delete_enhanced_user_rule(
    rule_id: str,
    user_id: str = Query(..., description="User ID for authorization"),
    supabase=Depends(get_supabase_client)
):
    """Delete an enhanced user rule."""
    try:
        uuid.UUID(rule_id)
        uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")
    
    result = supabase.table("user_rules_v2").delete().eq("id", rule_id).eq("user_id", user_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    return {"message": "Rule deleted successfully"}


@router.post("/preview", response_model=RulePreviewResponse)
async def preview_enhanced_user_rule(
    preview_request: RulePreviewRequest,
    supabase=Depends(get_supabase_client)
):
    """Preview what transactions would match a rule without saving it."""
    try:
        uuid.UUID(preview_request.user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format")
    
    # Fetch recent transactions for this user
    result = supabase.table("transactions").select(
        """
        id,
        date,
        original_description,
        clean_description,
        amount,
        merchants(name),
        transaction_categories(categories(name))
        """
    ).eq("user_id", preview_request.user_id).order("date", desc=True).limit(1000).execute()
    
    if not result.data:
        return RulePreviewResponse(
            rule_summary=generate_rule_summary(preview_request.conditions, preview_request.actions),
            total_transactions_checked=0,
            matching_transactions=[],
            would_override_count=0,
            sample_limit_reached=False
        )
    
    transactions = result.data
    matching_transactions = []
    would_override_count = 0
    
    for tx in transactions:
        # Convert transaction to evaluation format
        eval_tx = {
            "id": tx["id"],
            "date": tx["date"],
            "original_description": tx.get("original_description", ""),
            "clean_description": tx.get("clean_description", ""),
            "description": tx.get("clean_description") or tx.get("original_description", ""),
            "amount": tx.get("amount", 0),
            "merchant_name": tx.get("merchants", {}).get("name", "") if tx.get("merchants") else ""
        }
        
        # Evaluate rule against transaction
        if evaluate_rule_against_transaction(preview_request.conditions, eval_tx):
            # Check if this would override existing categorization
            current_category = None
            if tx.get("transaction_categories"):
                cats = tx["transaction_categories"]
                if cats and len(cats) > 0:
                    current_category = cats[0].get("categories", {}).get("name")
            
            if current_category:
                would_override_count += 1
            
            # Create match object
            match = TransactionMatch(
                transaction_id=tx["id"],
                date=tx["date"],
                description=tx.get("clean_description") or tx.get("original_description", ""),
                clean_description=tx.get("clean_description"),
                merchant_name=eval_tx["merchant_name"],
                amount=tx.get("amount", 0),
                current_category_name=current_category,
                matched_category_name="New Category",  # Would need category lookup
                confidence=1.0,
                match_method="user_rule_v2"
            )
            
            matching_transactions.append(match)
            
            # Limit results
            if len(matching_transactions) >= preview_request.limit:
                break
    
    return RulePreviewResponse(
        rule_summary=generate_rule_summary(preview_request.conditions, preview_request.actions),
        total_transactions_checked=len(transactions),
        matching_transactions=matching_transactions,
        would_override_count=would_override_count,
        sample_limit_reached=len(matching_transactions) >= preview_request.limit
    )


@router.post("/reorder")
async def reorder_enhanced_user_rules(
    user_id: str,
    rule_ids: List[str],
    supabase=Depends(get_supabase_client)
):
    """Reorder rules by updating their priority values."""
    try:
        uuid.UUID(user_id)
        for rule_id in rule_ids:
            uuid.UUID(rule_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")
    
    # Update priorities based on order in the list
    for index, rule_id in enumerate(rule_ids):
        priority = (index + 1) * 10  # Use 10, 20, 30, etc. to allow for insertion
        
        result = supabase.table("user_rules_v2").update({
            "priority": priority,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", rule_id).eq("user_id", user_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail=f"Rule {rule_id} not found")
    
    return {"message": "Rules reordered successfully"}


@router.post("/bulk")
async def bulk_update_enhanced_user_rules(
    user_id: str,
    updates: List[Dict[str, Any]],
    supabase=Depends(get_supabase_client)
):
    """Bulk update multiple rules."""
    try:
        uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format")
    
    results = []
    
    for update in updates:
        rule_id = update.get("id")
        if not rule_id:
            continue
            
        try:
            uuid.UUID(rule_id)
        except ValueError:
            continue
        
        update_data = {k: v for k, v in update.items() if k != "id"}
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        result = supabase.table("user_rules_v2").update(update_data).eq("id", rule_id).eq("user_id", user_id).execute()
        
        if result.data:
            results.append({"id": rule_id, "success": True})
        else:
            results.append({"id": rule_id, "success": False, "error": "Rule not found"})
    
    return {"results": results}


@router.post("/import")
async def import_enhanced_user_rules(
    user_id: str,
    rules: List[Dict[str, Any]],
    supabase=Depends(get_supabase_client)
):
    """Import multiple rules from JSON."""
    try:
        uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format")
    
    imported_count = 0
    
    for rule_data in rules:
        try:
            # Validate and clean rule data
            rule_data["user_id"] = user_id
            if "id" in rule_data:
                del rule_data["id"]  # Don't import IDs
            
            # Validate conditions and actions structure
            RuleConditions(**rule_data["conditions"])
            RuleActions(**rule_data["actions"])
            
            result = supabase.table("user_rules_v2").insert(rule_data).execute()
            
            if result.data:
                imported_count += 1
        except Exception as e:
            print(f"Failed to import rule: {e}")
            continue
    
    return {"message": f"Successfully imported {imported_count} rules"}


@router.get("/export")
async def export_enhanced_user_rules(
    user_id: str = Query(..., description="User ID"),
    supabase=Depends(get_supabase_client)
):
    """Export all rules for a user as JSON."""
    try:
        uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format")
    
    result = supabase.table("user_rules_v2").select("*").eq("user_id", user_id).order("priority").execute()
    
    if not result.data:
        return {"rules": []}
    
    # Remove user_id and timestamps for cleaner export
    export_rules = []
    for rule in result.data:
        clean_rule = {
            "name": rule["name"],
            "description": rule.get("description"),
            "enabled": rule["enabled"],
            "priority": rule["priority"],
            "conditions": rule["conditions"],
            "actions": rule["actions"]
        }
        export_rules.append(clean_rule)
    
    return {"rules": export_rules}
