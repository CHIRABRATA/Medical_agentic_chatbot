from functools import lru_cache
from google import genai
from google.genai import types
from pinecone import Pinecone, ServerlessSpec
from app.config import settings

@lru_cache(maxsize=1)
def get_genai_client():
    if not settings.gemini_api_key:
        raise ValueError("Missing GEMINI_API_KEY")
    return genai.Client(api_key=settings.gemini_api_key)

@lru_cache(maxsize=1)
def get_pinecone_client():
    if not settings.pinecone_api_key:
        raise ValueError("Missing PINECONE_API_KEY")
    return Pinecone(api_key=settings.pinecone_api_key)

def ensure_index():
    pc = get_pinecone_client()
    index_name = settings.pinecone_index
    if not pc.has_index(index_name):
        pc.create_index(
            name=index_name,
            dimension=1536,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1")
        )
    return pc.Index(index_name)

def embed(texts):
    ai = get_genai_client()
    single = isinstance(texts, str)
    contents = [texts] if single else list(texts)
    if not contents:
        return []

    response = ai.models.embed_content(
        model=settings.gemini_embedding_model,
        contents=contents,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_DOCUMENT",
            output_dimensionality=1536,
        )
    )
    vectors = [item.values for item in response.embeddings]
    return vectors[0] if single else vectors

def search_kb(query: str, top_k=5):
    try:
        index = ensure_index()
        vector = embed(query)
        results = index.query(
            vector=vector,
            top_k=top_k,
            include_metadata=True,
        )
        parsed = []
        matches = getattr(results, "matches", []) or results.get("matches", [])
        for m in matches:
            meta = getattr(m, "metadata", {}) or {}
            score = float(getattr(m, "score", 0.0) or 0.0)
            parsed.append({
                "score": score,
                "page": meta.get("page", 0),
                "text": meta.get("text", ""),
                "file": meta.get("file", "")
            })
        return parsed
    except Exception as e:
        print(f"Pinecone / KB search error: {e}", flush=True)
        return []
