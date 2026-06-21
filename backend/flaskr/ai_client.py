import os

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

MODEL_NAME = os.environ.get("OPENAI_MODEL", "gpt-4o")

client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
    base_url=os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1"),
)
