"""
Retroactive Rules Application Job - Background processing for applying rules to existing transactions.
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
import uuid
import asyncio
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
from enum import Enum

from ..dependencies import get_supabase_client, get_data_cache
from core.transaction_processor import _match_by_user_rules


router = APIRouter(
    prefix="/jobs",
    tags=["background_jobs"],
)


class JobStatus(str, Enum):
    """Job status enumeration."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class RetroactiveRulesJobRequest(BaseModel):
    """Request model for starting a retroactive rules application job."""
    user_id: str = Field(..., description="User ID to process transactions for")
    rule_ids: Optional[List[str]] = Field(None, description="Specific rule IDs to apply (if None, applies all active rules)")
    date_from: Optional[str] = Field(None, description="Only process transactions from this date (YYYY-MM-DD)")
    date_to: Optional[str] = Field(None, description="Only process transactions up to this date (YYYY-MM-DD)")
    batch_size: int = Field(default=100, ge=10, le=1000, description="Number of transactions to process in each batch")
    dry_run: bool = Field(default=False, description="If true, only reports what would be changed without making updates")


class JobProgress(BaseModel):
    """Model for job progress information."""
    job_id: str
    status: JobStatus
    user_id: str
    total_transactions: int
    processed_transactions: int
    updated_transactions: int
    error_count: int
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error_message: Optional[str] = None
    progress_percentage: float = 0.0
    estimated_completion: Optional[str] = None


class TransactionUpdate(BaseModel):
    """Model for a transaction update result."""
    transaction_id: str
    old_category_id: Optional[str] = None
    old_category_name: Optional[str] = None
    new_category_id: Optional[str] = None
    new_category_name: Optional[str] = None
    rule_id: str
    rule_description: Optional[str] = None
    updated: bool = False  # False for dry run or if no change needed


class RetroactiveRulesJobResponse(BaseModel):
    """Response model for retroactive rules job."""
    job_id: str
    status: JobStatus
    message: str
    progress: JobProgress


class JobResultSummary(BaseModel):
    """Summary of job results."""
    job_id: str
    status: JobStatus
    total_transactions: int
    updated_transactions: int
    error_count: int
    processing_time_seconds: float
    updates: List[TransactionUpdate]


# In-memory job tracking (in production, this would be stored in Redis or database)
job_store: Dict[str, Any] = {}  # Can store JobProgress or List[TransactionUpdate]


def _create_job_id() -> str:
    """Generate a unique job ID."""
    return str(uuid.uuid4())


def _get_job_progress(job_id: str) -> Optional[JobProgress]:
    """Retrieve job progress from store."""
    return job_store.get(job_id)


def _update_job_progress(job_id: str, **updates) -> None:
    """Update job progress in store."""
    if job_id in job_store:
        for key, value in updates.items():
            setattr(job_store[job_id], key, value)
        
        # Calculate progress percentage
        job = job_store[job_id]
        if job.total_transactions > 0:
            job.progress_percentage = (job.processed_transactions / job.total_transactions) * 100
            
        # Estimate completion time based on current progress
        if job.processed_transactions > 0 and job.started_at and job.status == JobStatus.RUNNING:
            started = datetime.fromisoformat(job.started_at.replace('Z', '+00:00'))
            elapsed = datetime.utcnow() - started.replace(tzinfo=None)
            rate = job.processed_transactions / elapsed.total_seconds()
            if rate > 0:
                remaining = job.total_transactions - job.processed_transactions
                estimated_seconds = remaining / rate
                estimated_completion = datetime.utcnow() + timedelta(seconds=estimated_seconds)
                job.estimated_completion = estimated_completion.isoformat() + 'Z'


async def _apply_rules_to_transactions_batch(
    transactions: List[Dict[str, Any]],
    user_rules: List[Dict[str, Any]],
    categories: List[Dict[str, Any]],
    merchants_map: Dict[str, str],
    dry_run: bool = False,
    supabase=None,
    job_id: Optional[str] = None
) -> List[TransactionUpdate]:
    """
    Apply rules to a batch of transactions and return the updates.
    
    Args:
        transactions: List of transaction dictionaries
        user_rules: List of user rules to apply
        categories: List of categories for name lookup
        merchants_map: Mapping of merchant IDs to names
        dry_run: If True, don't actually update the database
        supabase: Supabase client for database operations
        job_id: Job ID for progress tracking
        
    Returns:
        List of TransactionUpdate objects describing what was changed
    """
    updates = []
    
    for tx in transactions:
        try:
            # Convert transaction to format expected by rule matcher
            tx_data = {
                "description": tx.get("description"),
                "clean_description": tx.get("clean_description"),
                "original_description": tx.get("original_description"),
                "merchant_name": merchants_map.get(str(tx.get("merchant_id", "")), None) if tx.get("merchant_id") else None,
                "amount": tx.get("amount"),
                "date": tx.get("date"),
            }
            
            # Test rules against this transaction
            match_result = _match_by_user_rules(tx_data, user_rules, categories)
            
            if match_result:
                new_category_id = match_result.get("category_id")
                new_category_name = match_result.get("category_name")
                current_category_id = tx.get("primary_category_id")
                
                # Get current category name
                current_category_name = None
                if current_category_id:
                    current_category = next((c for c in categories if str(c.get('id')) == str(current_category_id)), None)
                    if current_category:
                        current_category_name = current_category.get('name')
                
                # Check if this is actually a change
                needs_update = str(current_category_id) != str(new_category_id) if current_category_id and new_category_id else bool(new_category_id)
                
                update = TransactionUpdate(
                    transaction_id=str(tx["id"]),
                    old_category_id=str(current_category_id) if current_category_id else None,
                    old_category_name=current_category_name,
                    new_category_id=str(new_category_id) if new_category_id else None,
                    new_category_name=new_category_name,
                    rule_id="multiple",  # Could be enhanced to track specific rule
                    rule_description="User rule match",
                    updated=needs_update and not dry_run
                )
                
                # Apply the update if not dry run and there's actually a change
                if needs_update and not dry_run and supabase:
                    try:
                        # Update the transaction's primary category using the RPC function
                        # This ensures proper audit trail and business logic
                        rpc_response = supabase.rpc(
                            "add_transaction_category_v2",
                            {
                                "p_tx_id": tx["id"],
                                "p_cat_id": new_category_id,
                                "p_user_id": tx["user_id"],
                            },
                        ).execute()
                        
                        if getattr(rpc_response, "error", None):
                            print(f"Error updating transaction {tx['id']}: {rpc_response.error}")
                            update.updated = False
                        else:
                            update.updated = True
                            
                    except Exception as e:
                        print(f"Exception updating transaction {tx['id']}: {e}")
                        update.updated = False
                
                updates.append(update)
                
        except Exception as e:
            print(f"Error processing transaction {tx.get('id', 'unknown')}: {e}")
            # Continue processing other transactions
            
    return updates


async def _run_retroactive_rules_job(
    job_id: str,
    request: RetroactiveRulesJobRequest,
    supabase,
    data_cache
) -> None:
    """
    Execute the retroactive rules application job in the background.
    
    This function runs asynchronously and updates job progress as it works.
    """
    try:
        _update_job_progress(
            job_id,
            status=JobStatus.RUNNING,
            started_at=datetime.utcnow().isoformat() + 'Z'
        )
        
        # Fetch user rules
        if request.rule_ids:
            # Fetch specific rules
            rules_response = supabase.table("user_rules").select("*").eq("user_id", request.user_id).in_("id", request.rule_ids).eq("enabled", True).execute()
        else:
            # Fetch all active rules for user
            rules_response = supabase.table("user_rules").select("*").eq("user_id", request.user_id).eq("enabled", True).execute()
        
        if getattr(rules_response, "error", None):
            raise Exception(f"Failed to fetch user rules: {rules_response.error}")
        
        user_rules = getattr(rules_response, "data", [])
        if not user_rules:
            _update_job_progress(
                job_id,
                status=JobStatus.COMPLETED,
                completed_at=datetime.utcnow().isoformat() + 'Z',
                error_message="No active rules found for user"
            )
            return
        
        # Build transaction query
        tx_query = supabase.table("transactions").select(
            "id, user_id, date, description, clean_description, merchant_id, amount, primary_category_id, original_description"
        ).eq("user_id", request.user_id)
        
        # Add date filters if specified
        if request.date_from:
            tx_query = tx_query.gte("date", request.date_from)
        if request.date_to:
            tx_query = tx_query.lte("date", request.date_to)
        
        # Get total count for progress tracking
        count_response = tx_query.execute()
        if getattr(count_response, "error", None):
            raise Exception(f"Failed to count transactions: {count_response.error}")
        
        all_transactions = getattr(count_response, "data", [])
        total_transactions = len(all_transactions)
        
        _update_job_progress(
            job_id,
            total_transactions=total_transactions
        )
        
        if total_transactions == 0:
            _update_job_progress(
                job_id,
                status=JobStatus.COMPLETED,
                completed_at=datetime.utcnow().isoformat() + 'Z'
            )
            return
        
        # Get merchants mapping for rule processing
        merchants_map = {str(merchant.get('id')): merchant.get('name') 
                        for merchant in data_cache.merchants if merchant.get('id')}
        
        # Process transactions in batches
        all_updates = []
        processed_count = 0
        updated_count = 0
        error_count = 0
        
        for i in range(0, total_transactions, request.batch_size):
            batch = all_transactions[i:i + request.batch_size]
            
            try:
                # Process this batch
                batch_updates = await _apply_rules_to_transactions_batch(
                    batch,
                    user_rules,
                    data_cache.categories,
                    merchants_map,
                    dry_run=request.dry_run,
                    supabase=supabase,
                    job_id=job_id
                )
                
                all_updates.extend(batch_updates)
                processed_count += len(batch)
                updated_count += sum(1 for update in batch_updates if update.updated)
                
                # Update progress
                _update_job_progress(
                    job_id,
                    processed_transactions=processed_count,
                    updated_transactions=updated_count,
                    error_count=error_count
                )
                
                # Small delay to prevent overwhelming the database
                await asyncio.sleep(0.1)
                
            except Exception as e:
                error_count += len(batch)
                print(f"Error processing batch {i//request.batch_size + 1}: {e}")
                
                _update_job_progress(
                    job_id,
                    processed_transactions=processed_count + len(batch),
                    error_count=error_count
                )
        
        # Job completed successfully
        _update_job_progress(
            job_id,
            status=JobStatus.COMPLETED,
            completed_at=datetime.utcnow().isoformat() + 'Z',
            processed_transactions=total_transactions,
            updated_transactions=updated_count,
            error_count=error_count
        )
        
        # Store results (in production, this would go to persistent storage)
        job_store[f"{job_id}_results"] = all_updates
        
    except Exception as e:
        _update_job_progress(
            job_id,
            status=JobStatus.FAILED,
            completed_at=datetime.utcnow().isoformat() + 'Z',
            error_message=str(e)
        )
        print(f"Retroactive rules job {job_id} failed: {e}")


@router.post("/retroactive-rules", response_model=RetroactiveRulesJobResponse)
async def start_retroactive_rules_job(
    request: RetroactiveRulesJobRequest,
    background_tasks: BackgroundTasks,
    supabase=Depends(get_supabase_client),
    data_cache=Depends(get_data_cache),
):
    """
    Start a background job to apply rules retroactively to existing transactions.
    
    This endpoint:
    - Validates the request parameters
    - Creates a background job to process transactions in batches
    - Returns a job ID for tracking progress
    - Applies user rules to existing transactions that haven't been processed
    - Updates transaction categories based on rule matches
    - Provides progress tracking and error handling
    """
    # Validate user_id format
    try:
        uuid.UUID(request.user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format")
    
    # Validate rule_ids format if provided
    if request.rule_ids:
        for rule_id in request.rule_ids:
            try:
                uuid.UUID(rule_id)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid rule_id format: {rule_id}")
    
    # Validate date formats if provided
    if request.date_from:
        try:
            datetime.strptime(request.date_from, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_from format. Use YYYY-MM-DD")
    
    if request.date_to:
        try:
            datetime.strptime(request.date_to, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_to format. Use YYYY-MM-DD")
    
    # Create job
    job_id = _create_job_id()
    
    # Initialize job progress
    progress = JobProgress(
        job_id=job_id,
        status=JobStatus.PENDING,
        user_id=request.user_id,
        total_transactions=0,
        processed_transactions=0,
        updated_transactions=0,
        error_count=0
    )
    
    job_store[job_id] = progress
    
    # Start background task
    background_tasks.add_task(
        _run_retroactive_rules_job,
        job_id,
        request,
        supabase,
        data_cache
    )
    
    return RetroactiveRulesJobResponse(
        job_id=job_id,
        status=JobStatus.PENDING,
        message="Retroactive rules application job started",
        progress=progress
    )


@router.get("/retroactive-rules/{job_id}", response_model=JobProgress)
def get_retroactive_rules_job_status(
    job_id: str,
):
    """
    Get the current status and progress of a retroactive rules application job.
    """
    try:
        uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job_id format")
    
    progress = _get_job_progress(job_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return progress


@router.get("/retroactive-rules/{job_id}/results", response_model=JobResultSummary)
def get_retroactive_rules_job_results(
    job_id: str,
    limit: int = Query(default=100, ge=1, le=1000, description="Maximum number of updates to return")
):
    """
    Get the detailed results of a completed retroactive rules application job.
    """
    try:
        uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job_id format")
    
    progress = _get_job_progress(job_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if progress.status not in [JobStatus.COMPLETED, JobStatus.FAILED]:
        raise HTTPException(status_code=400, detail="Job is not yet completed")
    
    # Get results
    results_key = f"{job_id}_results"
    all_updates = job_store.get(results_key, [])
    
    # Ensure all_updates is a list of TransactionUpdate objects
    if not isinstance(all_updates, list):
        all_updates = []
    
    # Calculate processing time
    processing_time = 0.0
    if progress.started_at and progress.completed_at:
        start_time = datetime.fromisoformat(progress.started_at.replace('Z', '+00:00'))
        end_time = datetime.fromisoformat(progress.completed_at.replace('Z', '+00:00'))
        processing_time = (end_time - start_time).total_seconds()
    
    return JobResultSummary(
        job_id=job_id,
        status=progress.status,
        total_transactions=progress.total_transactions,
        updated_transactions=progress.updated_transactions,
        error_count=progress.error_count,
        processing_time_seconds=processing_time,
        updates=all_updates[:limit]  # Limit results for performance
    )


@router.delete("/retroactive-rules/{job_id}")
def cancel_retroactive_rules_job(
    job_id: str,
):
    """
    Cancel a running retroactive rules application job.
    
    Note: This is a best-effort cancellation. Jobs that are already running
    may continue until the next batch checkpoint.
    """
    try:
        uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job_id format")
    
    progress = _get_job_progress(job_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if progress.status not in [JobStatus.PENDING, JobStatus.RUNNING]:
        raise HTTPException(status_code=400, detail="Job cannot be cancelled in current state")
    
    _update_job_progress(
        job_id,
        status=JobStatus.CANCELLED,
        completed_at=datetime.utcnow().isoformat() + 'Z'
    )
    
    return {"message": "Job cancellation requested", "job_id": job_id}


@router.get("/retroactive-rules", response_model=List[JobProgress])
def list_retroactive_rules_jobs(
    user_id: Optional[str] = Query(None, description="Filter jobs by user ID"),
    status: Optional[JobStatus] = Query(None, description="Filter jobs by status"),
    limit: int = Query(default=20, ge=1, le=100, description="Maximum number of jobs to return")
):
    """
    List retroactive rules application jobs with optional filtering.
    """
    if user_id:
        try:
            uuid.UUID(user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid user_id format")
    
    # Filter jobs based on criteria
    filtered_jobs = []
    for job in job_store.values():
        if isinstance(job, JobProgress):  # Skip result entries
            if user_id and job.user_id != user_id:
                continue
            if status and job.status != status:
                continue
            filtered_jobs.append(job)
    
    # Sort by creation time (newest first) and limit
    filtered_jobs.sort(key=lambda x: x.started_at or "", reverse=True)
    return filtered_jobs[:limit]
