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
    
    # CORS - can be set via CORS_ORIGINS env var as comma-separated string
    cors_origins: List[str] = [
        "http://localhost:3000",
        "https://main.do1k9oyyorn24.amplifyapp.com",
    ]
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Get CORS origins, supporting both JSON array and comma-separated env var."""
        import os
        import json
        env_origins = os.environ.get("CORS_ORIGINS", "")
        if env_origins:
            # Try to parse as JSON array first (Terraform jsonencode format)
            if env_origins.startswith("["):
                try:
                    origins = json.loads(env_origins)
                    if isinstance(origins, list):
                        return [o.strip() for o in origins if o.strip()]
                except json.JSONDecodeError:
                    pass
            # Fall back to comma-separated format
            return [o.strip() for o in env_origins.split(",") if o.strip()]
        return self.cors_origins
    
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
    
    def validate_slack_settings(self) -> list:
        """Validate Slack-related settings and return list of missing variables."""
        errors = []
        
        if not self.slack_client_id:
            errors.append("SLACK_CLIENT_ID is required for Slack integration")
        if not self.slack_client_secret:
            errors.append("SLACK_CLIENT_SECRET is required for Slack integration")
        if not self.slack_signing_secret:
            errors.append("SLACK_SIGNING_SECRET is required for Slack integration")
        if not self.token_encryption_key:
            errors.append("TOKEN_ENCRYPTION_KEY is required for Slack integration")
        if not self.supabase_url:
            errors.append("SUPABASE_URL is required for Slack connection storage")
        if not self.supabase_anon_key:
            errors.append("SUPABASE_ANON_KEY is required for Slack connection storage")
        
        return errors
    
    def validate_on_startup(self) -> None:
        """Validate all required settings on startup with logging."""
        import logging
        logger = logging.getLogger(__name__)
        
        # Validate required settings (raises exception if missing)
        self.validate_required_settings()
        
        # Validate Slack settings (warnings only - Slack is optional)
        slack_errors = self.validate_slack_settings()
        if slack_errors:
            for error in slack_errors:
                logger.warning(f"Slack configuration warning: {error}")
            logger.warning("Slack integration will not be available until all required variables are set")


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
