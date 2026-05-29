from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379"

    # AI
    GEMINI_API_KEY: str

    # App
    BACKEND_PORT: int = 8000
    ENVIRONMENT: str = "development"
    CACHE_TTL_SECONDS: int = 21600  # 6 hours

    # Scraping
    PLAYWRIGHT_TIMEOUT_MS: int = 30000
    MAX_DOCUMENTS_PER_COMPANY: int = 50

    class Config:
        env_file = ".env"

settings = Settings()
