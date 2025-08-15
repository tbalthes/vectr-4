from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")  # This loads variables from .env into os.environ

from fastapi import FastAPI
from app.routers import categorize

app = FastAPI()

app.include_router(categorize.router, prefix="/categorize")