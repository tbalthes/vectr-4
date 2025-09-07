"""
Categories Router - Management of hierarchical categories.
Provides tree structure, search, and management functionality.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
import uuid
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from ..dependencies import get_supabase_client, get_data_cache


router = APIRouter(
    prefix="/categories",
    tags=["categories"],
)


class CategoryResponse(BaseModel):
    """Response model for category data - Updated for Plaid categories."""
    category_id: str  # New primary key
    name: str  # Display name (plain_name for compatibility)
    plain_name: str  # Plaid display name  
    category: str  # Plaid category constant
    parent_category: Optional[str] = None  # Parent Plaid category constant
    parent_id: Optional[str] = None
    parent_name: Optional[str] = None
    icon: Optional[str] = None  # For compatibility
    icon_kebab: Optional[str] = None  # kebab-case icon
    lucide_icon: Optional[str] = None  # PascalCase Lucide icon
    description: Optional[str] = None
    user_id: Optional[str] = None
    children: List['CategoryResponse'] = Field(default_factory=list)
    depth: int = 0
    transaction_count: Optional[int] = None
    created_at: Optional[str] = None


class CategoryTreeResponse(BaseModel):
    """Response model for category tree structure."""
    categories: List[CategoryResponse]
    total_count: int
    max_depth: int


class CategoryCreate(BaseModel):
    """Model for creating a new category."""
    name: str = Field(..., min_length=1, max_length=100)
    icon: Optional[str] = Field(None, max_length=50)
    parent_id: Optional[str] = None
    user_id: Optional[str] = None  # For user-specific categories


class CategoryUpdate(BaseModel):
    """Model for updating a category."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    icon: Optional[str] = Field(None, max_length=50)
    parent_id: Optional[str] = None


def _build_category_response(cat: Dict[str, Any], transaction_count: Optional[int] = None) -> CategoryResponse:
    """Helper function to build CategoryResponse from database row - Updated for Plaid schema."""
    return CategoryResponse(
        category_id=str(cat.get('category_id')),
        name=cat.get('plain_name') or cat.get('name', ''),  # Use plain_name as display name
        plain_name=cat.get('plain_name', ''),
        category=cat.get('category', ''),
        parent_category=cat.get('parent_category'),
        parent_id=str(cat.get('parent_id')) if cat.get('parent_id') else None,
        parent_name=None,  # Will be populated if needed
        icon=cat.get('lucide_icon') or cat.get('icon'),  # Prefer lucide_icon
        icon_kebab=cat.get('icon_kebab'),
        lucide_icon=cat.get('lucide_icon'),
        description=cat.get('description'),
        user_id=str(cat.get('user_id')) if cat.get('user_id') else None,
        children=[],
        depth=0,
        transaction_count=transaction_count,
        created_at=str(cat.get('created_at')) if cat.get('created_at') else None,
    )
    icon: Optional[str] = Field(None, max_length=50)
    parent_id: Optional[str] = None


def _build_category_tree(categories: List[Dict[str, Any]]) -> List[CategoryResponse]:
    """
    Build a hierarchical tree structure from flat category list.
    
    Args:
        categories: Flat list of category dictionaries
        
    Returns:
        List of root categories with nested children
    """
    # Create lookup map
    category_map = {}
    for cat in categories:
        cat_id = str(cat.get('category_id'))  # Updated for new primary key
        category_map[cat_id] = _build_category_response(cat, cat.get('transaction_count', 0))
    
    # Build tree structure
    root_categories = []
    for cat in category_map.values():
        if cat.parent_id:
            # Add to parent's children
            parent = category_map.get(cat.parent_id)
            if parent:
                cat.parent_name = parent.name
                cat.depth = parent.depth + 1
                parent.children.append(cat)
            else:
                # Parent not found, treat as root
                root_categories.append(cat)
        else:
            # Root category
            root_categories.append(cat)
    
    # Sort categories by name
    def sort_categories(cats):
        cats.sort(key=lambda x: x.name.lower())
        for cat in cats:
            sort_categories(cat.children)
    
    sort_categories(root_categories)
    return root_categories


def _calculate_max_depth(categories: List[CategoryResponse]) -> int:
    """Calculate the maximum depth of the category tree."""
    max_depth = 0
    
    def traverse(cats, current_depth):
        nonlocal max_depth
        max_depth = max(max_depth, current_depth)
        for cat in cats:
            traverse(cat.children, current_depth + 1)
    
    traverse(categories, 0)
    return max_depth


@router.get("/tree", response_model=CategoryTreeResponse)
def get_categories_tree(
    user_id: Optional[str] = Query(None, description="User ID to include user-specific categories"),
    include_counts: bool = Query(False, description="Include transaction counts for each category"),
    data_cache=Depends(get_data_cache),
    supabase=Depends(get_supabase_client),
):
    """
    Get categories in hierarchical tree structure.
    
    This endpoint:
    - Returns categories organized as a tree with parent-child relationships
    - Supports both global and user-specific categories
    - Optionally includes transaction counts per category
    - Sorts categories alphabetically within each level
    """
    try:
        # Start with cached global categories
        categories = data_cache.categories.copy()
        
        # If user_id provided, fetch user-specific categories as well
        if user_id:
            try:
                uuid.UUID(user_id)
                user_categories_response = supabase.table("categories").select("*").eq("user_id", user_id).execute()
                if user_categories_response.data:
                    categories.extend(user_categories_response.data)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid user_id format")
            except Exception as e:
                # Don't fail if user categories can't be fetched
                print(f"Warning: Could not fetch user categories: {e}")
        
        # If transaction counts requested, fetch them
        if include_counts:
            try:
                # Get transaction counts per category with simple retry to handle transient errors
                attempts = 3
                counts_response = None
                for i in range(attempts):
                    try:
                        counts_response = supabase.rpc(
                            "get_category_transaction_counts",
                            {"p_user_id": user_id} if user_id else {}
                        ).execute()
                        break
                    except Exception as e:
                        # transient socket or schema-cache errors; retry briefly
                        if i < attempts - 1:
                            import time
                            time.sleep(0.05)
                            continue
                        raise

                if counts_response and counts_response.data:
                    count_map = {item['category_id']: item['count'] for item in counts_response.data}
                    for cat in categories:
                        cat['transaction_count'] = count_map.get(str(cat.get('category_id')), 0)
                else:
                    for cat in categories:
                        cat['transaction_count'] = 0
            except Exception as e:
                # Don't fail if counts can't be fetched
                print(f"Warning: Could not fetch transaction counts: {e}")
                for cat in categories:
                    cat['transaction_count'] = 0
        
        # Build tree structure
        tree_categories = _build_category_tree(categories)
        max_depth = _calculate_max_depth(tree_categories)
        
        return CategoryTreeResponse(
            categories=tree_categories,
            total_count=len(categories),
            max_depth=max_depth
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch categories tree: {str(e)}")


@router.get("/search", response_model=List[CategoryResponse])
def search_categories(
    q: str = Query(..., description="Search query for category names"),
    user_id: Optional[str] = Query(None, description="User ID to include user-specific categories"),
    limit: int = Query(default=50, le=100, description="Maximum number of results"),
    data_cache=Depends(get_data_cache),
    supabase=Depends(get_supabase_client),
):
    """
    Search categories by name.
    
    This endpoint:
    - Searches both global and user-specific categories
    - Performs case-insensitive partial matching
    - Returns flat list of matching categories
    - Includes parent information for context
    """
    try:
        # Start with cached global categories
        categories = data_cache.categories.copy()
        
        # If user_id provided, fetch user-specific categories as well
        if user_id:
            try:
                uuid.UUID(user_id)
                user_categories_response = supabase.table("categories").select("*").eq("user_id", user_id).execute()
                if user_categories_response.data:
                    categories.extend(user_categories_response.data)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid user_id format")
            except Exception as e:
                print(f"Warning: Could not fetch user categories: {e}")
        
        # Filter categories by search query
        query_lower = q.lower()
        matching_categories = []
        
        # Create parent lookup map for context
        parent_map = {str(cat.get('category_id')): cat.get('plain_name') or cat.get('name', '') for cat in categories}
        
        for cat in categories:
            cat_name = (cat.get('plain_name') or cat.get('name', '')).lower()
            if query_lower in cat_name:
                matching_categories.append(CategoryResponse(
                    category_id=str(cat.get('category_id')),
                    name=cat.get('plain_name') or cat.get('name', ''),
                    plain_name=cat.get('plain_name', ''),
                    category=cat.get('category', ''),
                    parent_category=cat.get('parent_category'),
                    parent_id=str(cat.get('parent_id')) if cat.get('parent_id') else None,
                    parent_name=parent_map.get(str(cat.get('parent_id'))) if cat.get('parent_id') else None,
                    icon=cat.get('lucide_icon') or cat.get('icon'),
                    icon_kebab=cat.get('icon_kebab'),
                    lucide_icon=cat.get('lucide_icon'),
                    description=cat.get('description'),
                    user_id=str(cat.get('user_id')) if cat.get('user_id') else None,
                    children=[],
                    depth=0,
                    transaction_count=cat.get('transaction_count'),
                    created_at=str(cat.get('created_at')) if cat.get('created_at') else None,
                ))
        
        # Sort by relevance (exact match first, then alphabetical)
        matching_categories.sort(key=lambda x: (
            not x.name.lower().startswith(query_lower),  # Exact prefix matches first
            x.name.lower()
        ))
        
        return matching_categories[:limit]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search categories: {str(e)}")


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: str,
    include_children: bool = Query(False, description="Include child categories"),
    data_cache=Depends(get_data_cache),
    supabase=Depends(get_supabase_client),
):
    """
    Get a specific category by ID.
    
    This endpoint:
    - Returns category details with optional children
    - Includes parent information if available
    - Supports both global and user-specific categories
    """
    try:
        uuid.UUID(category_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid category_id format")
    
    try:
        # Look in cached categories first
        category = None
        for cat in data_cache.categories:
            if str(cat.get('category_id')) == category_id:
                category = cat
                break
        
        # If not found in cache, try database
        if not category:
            response = supabase.table("categories").select("*").eq("category_id", category_id).single().execute()
            if not response.data:
                raise HTTPException(status_code=404, detail="Category not found")
            category = response.data
        
        # Build response
        parent_name = None
        if category.get('parent_id'):
            parent = next(
                (cat for cat in data_cache.categories if str(cat.get('category_id')) == str(category.get('parent_id'))),
                None
            )
            if parent:
                parent_name = parent.get('name')
        
        result = CategoryResponse(
            category_id=str(category.get('category_id')),
            name=category.get('plain_name') or category.get('name', ''),
            plain_name=category.get('plain_name', ''),
            category=category.get('category', ''),
            parent_category=category.get('parent_category'),
            parent_id=str(category.get('parent_id')) if category.get('parent_id') else None,
            parent_name=parent_name,
            icon=category.get('lucide_icon') or category.get('icon'),
            icon_kebab=category.get('icon_kebab'),
            lucide_icon=category.get('lucide_icon'),
            description=category.get('description'),
            user_id=str(category.get('user_id')) if category.get('user_id') else None,
            children=[],
            depth=0,
            transaction_count=category.get('transaction_count'),
            created_at=str(category.get('created_at')) if category.get('created_at') else None,
        )
        
        # Include children if requested
        if include_children:
            children = [
                CategoryResponse(
                    category_id=str(cat.get('category_id')),
                    name=cat.get('plain_name') or cat.get('name', ''),
                    plain_name=cat.get('plain_name', ''),
                    category=cat.get('category', ''),
                    parent_category=cat.get('parent_category'),
                    parent_id=str(cat.get('parent_id')) if cat.get('parent_id') else None,
                    parent_name=category.get('name'),
                    icon=cat.get('lucide_icon') or cat.get('icon'),
                    icon_kebab=cat.get('icon_kebab'),
                    lucide_icon=cat.get('lucide_icon'),
                    description=cat.get('description'),
                    user_id=str(cat.get('user_id')) if cat.get('user_id') else None,
                    children=[],
                    depth=1,
                    transaction_count=cat.get('transaction_count'),
                    created_at=str(cat.get('created_at')) if cat.get('created_at') else None,
                )
                for cat in data_cache.categories
                if str(cat.get('parent_id')) == category_id
            ]
            children.sort(key=lambda x: x.name.lower())
            result.children = children
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch category: {str(e)}")


@router.post("", response_model=CategoryResponse)
def create_category(
    payload: CategoryCreate,
    supabase=Depends(get_supabase_client),
    current_user: Any = None,  # Replace with real auth dependency
):
    """
    Create a new category.
    
    This endpoint:
    - Creates user-specific categories
    - Validates parent_id if provided
    - Enforces hierarchy depth limits
    - Prevents circular references
    """
    try:
        # Validate parent_id if provided
        if payload.parent_id:
            try:
                uuid.UUID(payload.parent_id)
                # Check if parent exists
                parent_response = supabase.table("categories").select("id,name").eq("id", payload.parent_id).single().execute()
                if not parent_response.data:
                    raise HTTPException(status_code=400, detail="Parent category not found")
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid parent_id format")
        
        # Determine user_id
        user_id = payload.user_id
        if not user_id and current_user:
            if isinstance(current_user, dict):
                user_id = current_user.get("id")
            else:
                user_id = getattr(current_user, "id", None)
        
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID required for category creation")
        
        try:
            uuid.UUID(user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid user_id format")
        
        # Create category
        insert_data = {
            "name": payload.name,
            "icon": payload.icon,
            "parent_id": payload.parent_id,
            "user_id": user_id,
        }
        
        response = supabase.table("categories").insert(insert_data).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to create category")
        
        created_category = response.data[0]
        
        # Get parent name if applicable
        parent_name = None
        if created_category.get('parent_id'):
            parent_response = supabase.table("categories").select("name").eq("id", created_category.get('parent_id')).single().execute()
            if parent_response.data:
                parent_name = parent_response.data.get('name')
        
        return CategoryResponse(
            category_id=str(created_category.get('id')),
            name=created_category.get('name', ''),
            plain_name=created_category.get('plain_name', created_category.get('name', '')),
            category=created_category.get('category', ''),
            parent_category=created_category.get('parent_category'),
            parent_id=str(created_category.get('parent_id')) if created_category.get('parent_id') else None,
            parent_name=parent_name,
            icon=created_category.get('lucide_icon') or created_category.get('icon'),
            icon_kebab=created_category.get('icon_kebab'),
            lucide_icon=created_category.get('lucide_icon'),
            description=created_category.get('description'),
            user_id=str(created_category.get('user_id')) if created_category.get('user_id') else None,
            children=[],
            depth=0,
            transaction_count=created_category.get('transaction_count'),
            created_at=str(created_category.get('created_at')) if created_category.get('created_at') else None,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create category: {str(e)}")


@router.patch("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: str,
    payload: CategoryUpdate,
    supabase=Depends(get_supabase_client),
    current_user: Any = None,  # Replace with real auth dependency
):
    """
    Update an existing category.
    
    This endpoint:
    - Updates user-specific categories only
    - Validates parent_id if provided
    - Prevents circular references
    - Enforces user ownership
    """
    try:
        uuid.UUID(category_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid category_id format")
    
    try:
        # Check if category exists and user owns it
        category_response = supabase.table("categories").select("*").eq("id", category_id).single().execute()
        if not category_response.data:
            raise HTTPException(status_code=404, detail="Category not found")
        
        category = category_response.data
        
        # Check user ownership (if user_id is set)
        if category.get('user_id') and current_user:
            user_id = None
            if isinstance(current_user, dict):
                user_id = current_user.get("id")
            else:
                user_id = getattr(current_user, "id", None)
            
            if str(category.get('user_id')) != str(user_id):
                raise HTTPException(status_code=403, detail="Cannot modify category owned by another user")
        
        # Validate parent_id if provided
        if payload.parent_id:
            try:
                uuid.UUID(payload.parent_id)
                # Check if parent exists
                parent_response = supabase.table("categories").select("id").eq("id", payload.parent_id).single().execute()
                if not parent_response.data:
                    raise HTTPException(status_code=400, detail="Parent category not found")
                
                # Prevent circular reference (category can't be its own parent or descendant)
                if payload.parent_id == category_id:
                    raise HTTPException(status_code=400, detail="Category cannot be its own parent")
                
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid parent_id format")
        
        # Build update data
        update_data = {}
        if payload.name is not None:
            update_data['name'] = payload.name
        if payload.icon is not None:
            update_data['icon'] = payload.icon
        if payload.parent_id is not None:
            update_data['parent_id'] = payload.parent_id
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Update category
        response = supabase.table("categories").update(update_data).eq("id", category_id).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to update category")
        
        updated_category = response.data[0]
        
        # Get parent name if applicable
        parent_name = None
        if updated_category.get('parent_id'):
            parent_response = supabase.table("categories").select("name").eq("id", updated_category.get('parent_id')).single().execute()
            if parent_response.data:
                parent_name = parent_response.data.get('name')
        
        return CategoryResponse(
            category_id=str(updated_category.get('id')),
            name=updated_category.get('plain_name') or updated_category.get('name', ''),
            plain_name=updated_category.get('plain_name', updated_category.get('name', '')),
            category=updated_category.get('category', ''),
            parent_category=updated_category.get('parent_category'),
            parent_id=str(updated_category.get('parent_id')) if updated_category.get('parent_id') else None,
            parent_name=parent_name,
            icon=updated_category.get('lucide_icon') or updated_category.get('icon'),
            icon_kebab=updated_category.get('icon_kebab'),
            lucide_icon=updated_category.get('lucide_icon'),
            description=updated_category.get('description'),
            user_id=str(updated_category.get('user_id')) if updated_category.get('user_id') else None,
            children=[],
            depth=0,
            transaction_count=updated_category.get('transaction_count'),
            created_at=str(updated_category.get('created_at')) if updated_category.get('created_at') else None,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update category: {str(e)}")


@router.delete("/{category_id}")
def delete_category(
    category_id: str,
    supabase=Depends(get_supabase_client),
    current_user: Any = None,  # Replace with real auth dependency
):
    """
    Delete a category.
    
    This endpoint:
    - Deletes user-specific categories only
    - Enforces user ownership
    - Prevents deletion if category has children
    - Prevents deletion if category is used in transactions
    """
    try:
        uuid.UUID(category_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid category_id format")
    
    try:
        # Check if category exists and user owns it
        category_response = supabase.table("categories").select("*").eq("id", category_id).single().execute()
        if not category_response.data:
            raise HTTPException(status_code=404, detail="Category not found")
        
        category = category_response.data
        
        # Check user ownership (only user-specific categories can be deleted)
        if not category.get('user_id'):
            raise HTTPException(status_code=403, detail="Cannot delete global categories")
        
        if current_user:
            user_id = None
            if isinstance(current_user, dict):
                user_id = current_user.get("id")
            else:
                user_id = getattr(current_user, "id", None)
            
            if str(category.get('user_id')) != str(user_id):
                raise HTTPException(status_code=403, detail="Cannot delete category owned by another user")
        
        # Check if category has children
        children_response = supabase.table("categories").select("id").eq("parent_id", category_id).execute()
        if children_response.data:
            raise HTTPException(status_code=400, detail="Cannot delete category with child categories")
        
        # Check if category is used in transactions
        usage_response = supabase.table("transaction_categories").select("transaction_id").eq("category_id", category_id).limit(1).execute()
        if usage_response.data:
            raise HTTPException(status_code=400, detail="Cannot delete category that is used in transactions")
        
        # Delete category
        delete_response = supabase.table("categories").delete().eq("id", category_id).execute()
        if not delete_response.data:
            raise HTTPException(status_code=500, detail="Failed to delete category")
        
        return {"success": True, "message": "Category deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete category: {str(e)}")


# Update forward reference for recursive model
CategoryResponse.model_rebuild()
