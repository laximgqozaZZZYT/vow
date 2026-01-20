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
    
    # JWT Authentication (Supabase - legacy)
    jwt_secret: str = "dev-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_audience: str = "authenticated"
    jwt_issuer: Optional[str] = None  # For custom JWT issuers
    
    # Cognito Authentication (AWS)
    cognito_user_pool_id: Optional[str] = None
    cognito_client_id: Optional[str] = None
    cognito_region: str = "ap-northeast-1"
    auth_provider: str = "supabase"  # "supabase" or "cognito"
    
    # CORS
    cors_origins: List[str] = [
        "http://localhost:3000",
        "https://main.do1k9oyyorn24.amplifyapp.com",
    ]
    
    # Slack Integration
    slack_webhook_url: Optional[str] = None
    slack_enabled: bool = False
    slack_client_id: Optional[str] = None
    slack_client_secret: Optional[str] = None
    slack_signing_secret: Optional[str] = None
    slack_callback_uri: Optional[str] = None
    token_encryption_key: Optional[str] = None
    
    # Supabase Client
    supabase_anon_key: Optional[str] = None
    
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


# Supabase client singleton
_supabase_client = None


def get_supabase_client():
    """Get or create Supabase client singleton."""
    global _supabase_client
    
    if _supabase_client is None:
        from supabase import create_client
        
        if not settings.supabase_url or not settings.supabase_anon_key:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY are required for Supabase client")
        
        _supabase_client = create_client(
            settings.supabase_url,
            settings.supabase_anon_key
        )
    
    return _supabase_client
