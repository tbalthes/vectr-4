from dotenv import load_dotenv
from pathlib import Path

# Ensure environment variables load from project root when running from python/ cwd
_THIS_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _THIS_DIR.parent.parent  # vectr-4/
# Load .env.local first (can override), then .env
load_dotenv(_PROJECT_ROOT / ".env.local")
load_dotenv(_PROJECT_ROOT / ".env")
\


import os
import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import categorize, transactions, user_rules, merchants, retroactive_rules, categories
from .routers import data_status
from .routers import transaction_upload, csv_processor, normalize, plaid_transactions, plaid_compatible_processor, plaid_api

# --- SENTRY SETUP ---
sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN", "https://da2b886dc958a8b541c06333efe5344a@o4510058699620352.ingest.us.sentry.io/4510058726883328"),
    send_default_pii=True,
    traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.2")),
)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Transaction Processing API"}

app.include_router(categorize.router)
app.include_router(transactions.router)
app.include_router(user_rules.router)  # Enhanced rules system
app.include_router(merchants.router)
app.include_router(retroactive_rules.router)
app.include_router(categories.router)
app.include_router(data_status.router)
app.include_router(transaction_upload.router)
app.include_router(csv_processor.router)
app.include_router(normalize.router)
app.include_router(plaid_transactions.router)  # Unified transaction processor
app.include_router(plaid_compatible_processor.router)  # Plaid processor compatible with existing frontend

app.include_router(plaid_api.router)  # Plaid webhooks and integration endpoints

# --- GLOBAL EXCEPTION HANDLER ---
from fastapi.responses import JSONResponse
from fastapi.requests import Request
import traceback

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print("GLOBAL EXCEPTION:", exc)
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
    )