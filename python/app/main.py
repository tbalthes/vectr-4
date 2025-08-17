from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")  # This loads variables from .env into os.environ

from fastapi import FastAPI
from .routers import categorize, transactions
from .routers import data_status
from .routers import transaction_upload

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Welcome to the Transaction Processing API"}

app.include_router(categorize.router)
app.include_router(transactions.router)
app.include_router(data_status.router)
app.include_router(transaction_upload.router)