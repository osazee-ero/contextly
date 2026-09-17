from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Contextly API"
    environment: str = "development"
    frontend_url: str = "http://localhost:3000"

    database_url: str
    
    storage_path: str = "storage/uploads"
    
    openai_api_key: str
    openai_embedding_model: str = "text-embedding-3-small"
    openai_chat_model: str = "gpt-5.6-luna"
    
    clerk_secret_key: str
    clerk_publishable_key: str

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )
    
    storage_backend: str = "local"

    aws_region: str = "ca-central-1"
    aws_s3_bucket: str = ""
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""


settings = Settings()