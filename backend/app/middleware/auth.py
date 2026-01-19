"""
JWT Authentication Middleware

Provides JWT token validation for protected endpoints.
Compatible with Supabase JWT format.
"""
from typing import Optional, List
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from jose import jwt, JWTError, ExpiredSignatureError

from app.config import settings


class JWTAuthMiddleware(BaseHTTPMiddleware):
    """
    JWT Authentication Middleware (Supabase JWT compatible).
    
    Validates JWT tokens from Authorization header and attaches
    user information to request state.
    """
    
    # Paths that don't require authentication
    EXCLUDED_PATHS: List[str] = [
        "/health",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/"
    ]
    
    async def dispatch(self, request: Request, call_next):
        """Process request and validate JWT if required."""
        # Skip authentication for excluded paths
        if self._is_excluded_path(request.url.path):
            return await call_next(request)
        
        # Extract token from Authorization header
        token = self._extract_token(request)
        if not token:
            raise HTTPException(
                status_code=401,
                detail="Missing authentication token"
            )
        
        # Verify token and extract user info
        try:
            payload = self._verify_token(token)
            request.state.user = payload
        except ExpiredSignatureError:
            raise HTTPException(
                status_code=401,
                detail="Token has expired"
            )
        except JWTError as e:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token"
            )
        
        return await call_next(request)
    
    def _is_excluded_path(self, path: str) -> bool:
        """Check if path is excluded from authentication."""
        # Exact match or prefix match for paths like /health/detailed
        for excluded in self.EXCLUDED_PATHS:
            if path == excluded or path.startswith(f"{excluded}/"):
                return True
        return False
    
    def _extract_token(self, request: Request) -> Optional[str]:
        """Extract JWT token from Authorization header."""
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            return auth_header[7:]
        return None
    
    def _verify_token(self, token: str) -> dict:
        """
        Verify JWT token and return payload.
        
        Supports both Supabase JWT format and custom JWT issuers.
        """
        options = {
            "verify_aud": True,
            "verify_exp": True,
            "verify_iss": settings.jwt_issuer is not None,
        }
        
        return jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
            options=options
        )


def get_current_user(request: Request) -> dict:
    """
    Dependency to get current authenticated user from request state.
    
    Usage:
        @router.get("/protected")
        async def protected_route(user: dict = Depends(get_current_user)):
            return {"user_id": user.get("sub")}
    """
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated"
        )
    return user


def get_user_id(request: Request) -> str:
    """
    Dependency to get current user's ID from request state.
    
    Usage:
        @router.get("/my-data")
        async def my_data(user_id: str = Depends(get_user_id)):
            return {"user_id": user_id}
    """
    user = get_current_user(request)
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="User ID not found in token"
        )
    return user_id
