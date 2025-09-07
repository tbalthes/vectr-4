from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")  # This loads variables from .env into os.environ

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import categorize, transactions, user_rules, merchants, retroactive_rules, categories
from .routers import data_status
from .routers import transaction_upload, csv_processor, normalize

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