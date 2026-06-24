import os

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()


def _mongo_uri() -> str:
    uri = os.environ.get("MONGODB_URI")
    if uri:
        return uri

    user = os.environ.get("DB_USER")
    password = os.environ.get("DB_PASSWORD")
    return f"mongodb+srv://{user}:{password}@data.rnsqw.mongodb.net/"


mongo_client = MongoClient(_mongo_uri())
db = mongo_client["experian"]

tags_collection = db["tags"]
pdf_collection = db["pdf"]
jd_collection = db["jobDescription"]
task_collection = db['tasks']

UPLOAD_DIR = os.environ.get("UPLOAD_DIR")