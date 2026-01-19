"""
Application Configuration

Uses Pydantic Settings for environment variable management.
All sensitive values should be provided via environment variables.
"""
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )
    
    # Application
    app_name: str = "Vow Backend API"
    app_version: str = "1.0.0"
    debug: bool = False
    
    # Database - Primary (RDS)
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/vow_dev"
    
    # Database - Supabase (Migration period)
    supabase_url: Optional[str] = None
    supabase_database_url: Optional[str] = None
    migration_mode: bool = False  # Enable dual-write to both databases
    
    # JWT Authentication
    jwt_secret: str = "dev-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_audience: str = "authenticated"
    jwt_issuer: Optional[str] = None  # For custom JWT issuers
    
    # CORS
    cors_origins: List[str] = ["http://localhost:3000"]
    
    # Slack Integration
    slack_webhook_url: Optional[str] = None
    slack_enabled: bool = False
    
    # OpenAI Integration
    openai_api_key: Optional[str] = None
    openai_enabled: bool = False
    openai_model: str = "gpt-4o-mini"
    openai_max_requests_per_minute: int = 60
    
    def validate_required_settings(self) -> None:
        """Validate required settings on startup."""
        errors = []
        
        if not self.database_url:
            errors.append("DATABASE_URL is required")
        
        if self.jwt_secret == "dev-secret-key-change-in-production" and not self.debug:
            errors.append("JWT_SECRET must be set in production")
        
        if errors:
            raise ValueError(f"Configuration errors: {', '.join(errors)}")


# Global settings instance
settings = Settings()
