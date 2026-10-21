from functools import lru_cache
# pyrefly: ignore [missing-import]
from google import genai
from pinecone import pinecone, ServerlessSpec

from dotenv import load_dotenv
from app.config import settings



def clients():
    if not settings.gemini_api_key or not settings.pinecone_api_key or not settings.tavily_api_key:
        raise ValueError("missing required api keys")
    return genai.Client(api_key=settings.gemini_api_key)

@lru_cache(maxsize=1)
def pinecone_index():
    if not settings.pinecone_api_key or not settings.pinecone_index:
        raise ValueError("missing pinecone api key or index name")
    pinecone.init(api_key=settings.pinecone_api_key,environment="gcp-starter")
    return pinecone.Index(settings.pinecone_index)