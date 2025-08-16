from fastapi import APIRouter, Depends
from ..dependencies import get_data_cache

router = APIRouter(prefix="/data-table-status", tags=["data-table-status"])

@router.get("/")
def get_status(data_cache = Depends(get_data_cache)):
    return {
        "last_refresh": data_cache.last_refresh.isoformat() if data_cache.last_refresh else None,
        "global_regex_rules_count": len(data_cache.global_regex_rules),
        "mcc_category_map_count": len(data_cache.mcc_category_map),
        "categories_count": len(data_cache.categories),
    }
