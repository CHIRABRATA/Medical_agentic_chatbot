import pydantic_settings
import pydantic_settings
import pydantic_settings
import pydantic_settings
import pydantic_settings
import os 
import certifi
from dotenv import load_dotenv



# --- AUTOMATIC SSL FIX FOR CONDA/PYTHON ENVIRONMENTS
ssl_cert = os.environ.get('SSL_CERT_FILE')
if not ssl_cert or not os.path.exists(ssl_cert):
    os.environ['SSL_CERT_FILE'] = certifi.where()


load_dotenv()

from pydantic_settings import BaseSettings

class settings(BaseSettings):
    gemini_api_key: str
    tavily_api_key: str
    pinecone_api_key: str
    pinecone_index:str 
    

    class Config:
        env_file = ".env"

settings=settings()