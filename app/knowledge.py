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

def ensure_index():
    _.pc =clients()
    if not pc.has_index(settings.pinecone_index):
        pc.create_index(
            settings.pinecone_index,
            dimension=1536,
            metric="cosine"
            )
    return pc.Index(settings.pinecone_index)
    

def embed(texts):
    ai=clients()
    return ai.embed_content(
        model="gemini-embedding-001",
        contents=texts,
        config=genai.types.EmbeddingConfig(
            task_type="retrieval_document",
            output_dimensionality=1536,
        )
    )

def search_kb(query:str,top_k=5):
        index=ensure_index()
        vector=embed(query)["embedding"]
        results=index.query(
            vector=vector,
            top_k=top_k,
            include_metadata=True,
        )
        return results
