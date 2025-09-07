"""
Enhanced User Rules Router - supports complex AND/OR conditions like Monarch Money
Provides user-friendly interface for creating sophisticated transaction rules.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
import uuid
import json
from typing import List, Dict, Any, Optional, Union
from datetime import datetime
from pydantic import BaseModel, Field, validator
import time
import httpx
from datetime import datetime, timedelta

from ..dependencies import get_supabase_client, get_data_cache


router = APIRouter(
    prefix="/user_rules",
    tags=["user_rules"],
)


# =============================================
# ENHANCED PYDANTIC MODELS
# =============================================

class RuleCondition(BaseModel):
    """Single condition within a rule."""
    field: str = Field(..., description="Field to match: description, merchant, amount, category")
    operator: str = Field(..., description="Operator: equals, contains, starts_with, ends_with, greater_than, less_than")
    value: Union[str, int, float] = Field(..., description="Value to match against")
    case_sensitive: bool = Field(default=False, description="Whether text matching is case sensitive")
    
    @validator('field')
    def validate_field(cls, v):
        allowed_fields = ['description', 'merchant', 'amount', 'category', 'accounts', 'date']
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


class ReorderRulesResponse(BaseModel):
    """Response model for reorder operation."""
    message: str
    rules: List[EnhancedUserRuleResponse]


class ReorderRulesRequest(BaseModel):
    """Request model for reorder operation."""
    user_id: str
    rule_ids: List[str]


class PreviewRulesRequest(BaseModel):
    """Request model for rule preview."""
    user_id: str
    conditions: RuleConditions
    actions: Optional[RuleActions] = None
    limit: Optional[int] = 100


class PreviewRulesResponse(BaseModel):
    """Response model for rule preview."""
    matching_transactions: int
    preview_transactions: List[Dict[str, Any]]


@router.post("/preview")
async def preview_enhanced_user_rules(
    preview_data: PreviewRulesRequest,
    supabase=Depends(get_supabase_client)
) -> PreviewRulesResponse:
    """Preview how many transactions would match a rule."""
    try:
        # Validate user_id
        uuid.UUID(preview_data.user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format")
    
    try:
        # Build a simple query to count matching transactions
        # This is a basic implementation - you can enhance it based on your transaction table structure
        query = supabase.table("transactions").select("*", count="exact").eq("user_id", preview_data.user_id)
        
        # Apply condition filters (simplified version)
        for group in preview_data.conditions.groups:
            for condition in group.conditions:
                if condition.field == "description" and condition.operator == "contains":
                    query = query.ilike("description", f"%{condition.value}%")
                elif condition.field == "merchant" and condition.operator == "contains":
                    query = query.ilike("merchant_name", f"%{condition.value}%")
                elif condition.field == "amount" and condition.operator == "equals":
                    query = query.eq("amount", float(condition.value))
                elif condition.field == "amount" and condition.operator == "greater_than":
                    query = query.gt("amount", float(condition.value))
                elif condition.field == "amount" and condition.operator == "less_than":
                    query = query.lt("amount", float(condition.value))
                # Add more condition handling as needed
        
        # Limit results for preview
        if preview_data.limit:
            query = query.limit(preview_data.limit)
        
        result = query.execute()
        
        matching_count = result.count or 0
        preview_transactions = result.data or []
        
        return PreviewRulesResponse(
            matching_transactions=matching_count,
            preview_transactions=preview_transactions
        )
        
    except Exception as e:
        print(f"ERROR: failed to preview rules: {e}")
        # Return empty result instead of error for better UX
        return PreviewRulesResponse(
            matching_transactions=0,
            preview_transactions=[]
        )


@router.post("/")
async def create_enhanced_user_rule(
    rule: EnhancedUserRuleCreate,
    supabase=Depends(get_supabase_client)
) -> EnhancedUserRuleResponse:
    """Create a new enhanced user rule."""
    try:
        # Validate user_id
        uuid.UUID(rule.user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format")
    
    try:
        # Prepare rule data for database
        rule_data = {
            "id": str(uuid.uuid4()),
            "user_id": rule.user_id,
            "name": rule.name,
            "description": rule.description,
            "enabled": rule.enabled,
            "priority": rule.priority,
            "conditions": rule.conditions.dict(),
            "actions": rule.actions.dict(),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Insert into database
        result = supabase.table("user_rules").insert(rule_data).execute()
        
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
        
    except Exception as e:
        print(f"ERROR: failed to create rule: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create rule: {str(e)}")


@router.post("/reorder")
async def reorder_enhanced_user_rules(
    payload: ReorderRulesRequest,
    supabase=Depends(get_supabase_client)
) -> ReorderRulesResponse:
    """Reorder rules by updating their priority values."""
    try:
        uuid.UUID(payload.user_id)
        for rule_id in payload.rule_ids:
            uuid.UUID(rule_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")
    
    # Fetch all user's rules to determine current priority range
    try:
        all_rules_res = supabase.table("user_rules").select("id", "priority").eq("user_id", payload.user_id).order("priority").execute()
        if not all_rules_res.data:
            return ReorderRulesResponse(message="No rules to reorder", rules=[])
        all_rules = all_rules_res.data if isinstance(all_rules_res.data, list) else [all_rules_res.data]
        all_ids = [r["id"] for r in all_rules]

        # Find the maximum current priority to avoid conflicts
        max_priority = max((r["priority"] for r in all_rules), default=100)
        temp_base = max_priority + 1000  # Use high temporary priorities to avoid conflicts
    except Exception as e:
        print(f"ERROR: failed to fetch user's rules for reorder: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch user's rules: {str(e)}")

    # Build new order: start with provided rule_ids, then append remaining ids preserving existing order
    provided_set = {rid for rid in payload.rule_ids}
    new_order = []
    for rid in payload.rule_ids:
        if rid in all_ids:
            new_order.append(rid)
    for rid in all_ids:
        if rid not in provided_set:
            new_order.append(rid)

    # Two-phase update with high temporary priorities to avoid UI flickering
    from postgrest.exceptions import APIError as PostgrestAPIError
    import traceback

    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        try:
            # Phase 1: assign temporary high priorities for all affected ids
            for index, rid in enumerate(new_order):
                temp_priority = temp_base + (index * 10)
                resp = supabase.table("user_rules").update({
                    "priority": temp_priority,
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("id", rid).eq("user_id", payload.user_id).execute()
                if not resp.data:
                    raise HTTPException(status_code=404, detail=f"Rule {rid} not found (phase 1)")

            # Phase 2: assign final positive priorities
            for index, rid in enumerate(new_order):
                final_priority = (index + 1) * 10
                resp = supabase.table("user_rules").update({
                    "priority": final_priority,
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("id", rid).eq("user_id", payload.user_id).execute()
                if not resp.data:
                    raise HTTPException(status_code=500, detail=f"Failed to set final priority for {rid}")

            # Fetch updated rules to return current state and avoid UI latency issues
            try:
                updated_rules_res = supabase.table("user_rules").select("*").eq("user_id", payload.user_id).order("priority").execute()
                updated_rules = []
                if updated_rules_res.data:
                    rules_data = updated_rules_res.data if isinstance(updated_rules_res.data, list) else [updated_rules_res.data]
                    for rule_data in rules_data:
                        updated_rules.append({
                            "id": rule_data["id"],
                            "user_id": rule_data["user_id"],
                            "name": rule_data["name"],
                            "description": rule_data.get("description"),
                            "enabled": rule_data["enabled"],
                            "priority": rule_data["priority"],
                            "conditions": rule_data["conditions"],
                            "actions": rule_data["actions"],
                            "created_at": rule_data.get("created_at"),
                            "updated_at": rule_data.get("updated_at")
                        })
                
                # Small delay to ensure database consistency
                time.sleep(0.2)
                
                return ReorderRulesResponse(
                    message="Rules reordered successfully",
                    rules=[EnhancedUserRuleResponse(**rule) for rule in updated_rules]
                )
                
            except Exception as e:
                print(f"WARNING: failed to fetch updated rules after reorder: {e}")
                # Still return success even if we can't fetch updated rules
                return ReorderRulesResponse(message="Rules reordered successfully", rules=[])
            
        except PostgrestAPIError as e:
            err = getattr(e, "args", [None])[0]
            if err and isinstance(err, dict) and err.get("code") == "23505":
                print(f"WARNING: duplicate key during reorder attempt {attempt}: {err}")
                if attempt < max_attempts:
                    print(f"Retrying in {0.1 * attempt} seconds...")
                    time.sleep(0.1 * attempt)
                    continue
                else:
                    print(f"All {max_attempts} attempts failed due to duplicate key constraint")
                    raise HTTPException(status_code=500, detail="Failed to reorder rules: duplicate key constraint persists after retries")
            
            # Not a retryable error
            tb = traceback.format_exc()
            print(f"ERROR: failed during two-phase reorder: {e}\n{tb}")
            raise HTTPException(status_code=500, detail=f"Failed to reorder rules: {str(e)}")
        except HTTPException:
            raise
        except Exception as e:
            tb = traceback.format_exc()
            print(f"ERROR: failed during two-phase reorder: {e}\n{tb}")
            raise HTTPException(status_code=500, detail=f"Failed to reorder rules: {str(e)}")
    
    # This should never be reached due to the return/raise in the loop
    raise HTTPException(status_code=500, detail="Failed to reorder rules after all attempts")


@router.put("/{rule_id}")
async def update_enhanced_user_rule(
    rule_id: str,
    user_id: str = Query(..., description="User ID"),
    update_data: Optional[EnhancedUserRuleUpdate] = None,
    supabase=Depends(get_supabase_client)
):
    """Update a single enhanced user rule."""
    try:
        uuid.UUID(user_id)
        uuid.UUID(rule_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")
    
    if update_data is None:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    # Fetch the rule to ensure it exists and belongs to the user
    try:
        result = supabase.table("user_rules").select("*").eq("id", rule_id).eq("user_id", user_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Rule not found or does not belong to user")
        rule_data = result.data[0] if isinstance(result.data, list) else result.data
    except Exception as e:
        print(f"ERROR: failed to fetch rule for update: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch rule: {str(e)}")
    
    # Build update payload
    update_payload = {}
    if update_data.name is not None:
        update_payload["name"] = update_data.name
    if update_data.description is not None:
        update_payload["description"] = update_data.description
    if update_data.enabled is not None:
        update_payload["enabled"] = update_data.enabled
    if update_data.priority is not None:
        update_payload["priority"] = update_data.priority
    if update_data.conditions is not None:
        update_payload["conditions"] = update_data.conditions.dict()
    if update_data.actions is not None:
        update_payload["actions"] = update_data.actions.dict()
    
    if not update_payload:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    # Add updated_at timestamp
    update_payload["updated_at"] = datetime.utcnow().isoformat()
    
    # Update the rule
    try:
        update_result = supabase.table("user_rules").update(update_payload).eq("id", rule_id).eq("user_id", user_id).execute()
        if not update_result.data:
            raise HTTPException(status_code=500, detail="Failed to update rule")
    except Exception as e:
        print(f"ERROR: failed to update rule: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update rule: {str(e)}")
    
    # Return the updated rule
    updated_rule = update_result.data[0] if isinstance(update_result.data, list) else update_result.data
    return {
        "id": updated_rule["id"],
        "user_id": updated_rule["user_id"],
        "name": updated_rule["name"],
        "description": updated_rule.get("description"),
        "enabled": updated_rule["enabled"],
        "priority": updated_rule["priority"],
        "conditions": updated_rule["conditions"],
        "actions": updated_rule["actions"],
        "created_at": updated_rule.get("created_at"),
        "updated_at": updated_rule.get("updated_at")
    }


@router.get("/")
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
    query = supabase.table("user_rules").select("*", count="exact").eq("user_id", user_id)
    
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
    
    # Convert to response model - simplified for now
    rules = []
    for rule_data in result.data:
        rules.append({
            "id": rule_data["id"],
            "user_id": rule_data["user_id"],
            "name": rule_data["name"],
            "description": rule_data.get("description"),
            "enabled": rule_data["enabled"],
            "priority": rule_data["priority"],
            "conditions": rule_data["conditions"],
            "actions": rule_data["actions"],
            "created_at": rule_data.get("created_at"),
            "updated_at": rule_data.get("updated_at")
        })
    
    return {
        "rules": rules,
        "total": result.count or 0,
        "page": page,
        "page_size": page_size
    }
