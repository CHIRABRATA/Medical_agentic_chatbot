import os
import certifi
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Automatic SSL fix for Windows / Conda / Python environments
ssl_cert = os.environ.get('SSL_CERT_FILE')
if not ssl_cert or not os.path.exists(ssl_cert):
    os.environ['SSL_CERT_FILE'] = certifi.where()

load_dotenv()

class Settings(BaseSettings):
    gemini_api_key: str = ""
    gemini_chat_model: str = "gemini-flash-lite-latest"
    gemini_embedding_model: str = "gemini-embedding-001"
    tavily_api_key: str = ""
    pinecone_api_key: str = ""
    pinecone_index: str = "medical-chatbot"
    openai_api_key: str = ""
    openai_chat_model: str = "gpt-4o-mini"
    openai_vision_model: str = "gpt-4o-mini"
    allowed_origins: str = "*"
    api_token: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()