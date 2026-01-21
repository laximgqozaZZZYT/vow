"""
JWT Authentication Middleware

Provides JWT token validation for protected endpoints.
Supports both Supabase JWT and AWS Cognito JWT formats.
"""
import json
import time
from typing import Optional, List, Dict, Any
from urllib.request import urlopen

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from jose import jwt, JWTError, ExpiredSignatureError, jwk

from app.config import settings


# Cache for Cognito JWKS
_jwks_cache: Dict[str, Any] = {}
_jwks_cache_time: float = 0
JWKS_CACHE_TTL = 3600  # 1 hour


def get_cognito_jwks() -> Dict[str, Any]:
    """
    Fetch and cache Cognito JWKS (JSON Web Key Set).
    
    Returns cached keys if available and not expired.
    """
    global _jwks_cache, _jwks_cache_time
    
    current_time = time.time()
    if _jwks_cache and (current_time - _jwks_cache_time) < JWKS_CACHE_TTL:
        return _jwks_cache
    
    if not settings.cognito_user_pool_id or not settings.cognito_region:
        raise ValueError("Cognito configuration is missing")
    
    jwks_url = (
        f"https://cognito-idp.{settings.cognito_region}.amazonaws.com/"
        f"{settings.cognito_user_pool_id}/.well-known/jwks.json"
    )
    
    with urlopen(jwks_url, timeout=10) as response:
        _jwks_cache = json.loads(response.read().decode("utf-8"))
        _jwks_cache_time = current_time
    
    return _jwks_cache


def get_cognito_public_key(token: str) -> Optional[str]:
    """
    Get the public key for verifying a Cognito JWT.
    
    Matches the key ID (kid) from the token header with JWKS.
    """
    try:
        headers = jwt.get_unverified_headers(token)
        kid = headers.get("kid")
        
        if not kid:
            return None
        
        jwks = get_cognito_jwks()
        
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                return jwk.construct(key).to_pem().decode("utf-8")
        
        return None
    except Exception:
        return None


class JWTAuthMiddleware(BaseHTTPMiddleware):
    """
    JWT Authentication Middleware.
    
    Supports both Supabase JWT (HS256) and Cognito JWT (RS256).
    Validates JWT tokens from Authorization header and attaches
    user information to request state.
    
    Handles API Gateway stage prefixes (e.g., /development, /production)
    by stripping them before matching excluded paths.
    """
    
    # Paths that don't require authentication (without stage prefix)
    EXCLUDED_PATHS: List[str] = [
        "/health",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/",
        "/api/slack/connect",  # OAuth initiation - token passed via query param
        "/api/slack/commands",
        "/api/slack/interactions",
        "/api/slack/events",
        "/api/slack/callback",  # OAuth callback doesn't have auth header
    ]
    
    # Known API Gateway stage prefixes
    STAGE_PREFIXES: List[str] = [
        "/development",
        "/production",
        "/staging",
    ]
    
    async def dispatch(self, request: Request, call_next):
        """Process request and validate JWT if required."""
        import logging
        logger = logging.getLogger(__name__)
        
        # Skip authentication for OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            logger.info("Skipping auth for OPTIONS preflight request")
            return await call_next(request)
        
        # Debug logging for path analysis
        original_path = request.url.path
        normalized_path = self._strip_stage_prefix(original_path)
        logger.info(f"Auth middleware - Original path: {original_path}, Normalized: {normalized_path}")
        
        # Skip authentication for excluded paths
        if self._is_excluded_path(request.url.path):
            logger.info(f"Path {original_path} is excluded from authentication")
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
            if settings.auth_provider == "cognito":
                payload = self._verify_cognito_token(token)
            else:
                payload = self._verify_supabase_token(token)
            
            request.state.user = payload
        except ExpiredSignatureError:
            raise HTTPException(
                status_code=401,
                detail="Token has expired"
            )
        except JWTError:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token"
            )
        except Exception as e:
            raise HTTPException(
                status_code=401,
                detail=f"Authentication error: {str(e)}"
            )
        
        return await call_next(request)
    
    def _strip_stage_prefix(self, path: str) -> str:
        """
        Strip API Gateway stage prefix from path.
        
        API Gateway adds stage name (e.g., /development, /production) to the path.
        This method removes it for consistent path matching.
        """
        for prefix in self.STAGE_PREFIXES:
            if path.startswith(prefix):
                stripped = path[len(prefix):]
                return stripped if stripped else "/"
        return path
    
    def _is_excluded_path(self, path: str) -> bool:
        """Check if path is excluded from authentication."""
        # Strip stage prefix first for consistent matching
        normalized_path = self._strip_stage_prefix(path)
        
        for excluded in self.EXCLUDED_PATHS:
            if normalized_path == excluded or normalized_path.startswith(f"{excluded}/"):
                return True
        return False
    
    def _extract_token(self, request: Request) -> Optional[str]:
        """Extract JWT token from Authorization header."""
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            return auth_header[7:]
        return None
    
    def _verify_supabase_token(self, token: str) -> dict:
        """
        Verify Supabase JWT token.
        
        Supports both:
        - ES256 (asymmetric): Uses JWKS endpoint to get public key
        - HS256 (symmetric): Uses JWT_SECRET for verification
        """
        import logging
        logger = logging.getLogger(__name__)
        
        # Get token header to check algorithm
        try:
            headers = jwt.get_unverified_headers(token)
            token_alg = headers.get("alg", "unknown")
            token_kid = headers.get("kid")
            logger.info(f"Supabase token algorithm: {token_alg}, kid: {token_kid}")
        except Exception as e:
            logger.error(f"Failed to get token headers: {e}")
            raise JWTError(f"Invalid token format: {e}")
        
        # Determine verification method based on algorithm
        if token_alg in ["ES256", "ES384", "ES512", "RS256", "RS384", "RS512"]:
            # Asymmetric algorithm - use JWKS
            return self._verify_with_jwks(token, token_alg, token_kid)
        else:
            # Symmetric algorithm (HS256, etc.) - use JWT_SECRET
            options = {
                "verify_aud": True,
                "verify_exp": True,
                "verify_iss": settings.jwt_issuer is not None,
            }
            
            return jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=["HS256", "HS384", "HS512"],
                audience=settings.jwt_audience,
                issuer=settings.jwt_issuer,
                options=options
            )
    
    def _verify_with_jwks(self, token: str, alg: str, kid: str) -> dict:
        """Verify JWT using JWKS public key."""
        import logging
        logger = logging.getLogger(__name__)
        
        jwks = self._get_supabase_jwks()
        
        # Find the key with matching kid
        public_key = None
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                public_key = jwk.construct(key).to_pem().decode("utf-8")
                break
        
        if not public_key:
            # If no kid match, try the first key
            if jwks.get("keys"):
                logger.warning(f"No key found with kid={kid}, using first available key")
                public_key = jwk.construct(jwks["keys"][0]).to_pem().decode("utf-8")
            else:
                raise JWTError("No public keys available in JWKS")
        
        # Verify token with public key
        return jwt.decode(
            token,
            public_key,
            algorithms=[alg],
            audience=settings.jwt_audience,
            options={
                "verify_aud": True,
                "verify_exp": True,
            }
        )
    
    def _get_supabase_jwks(self) -> dict:
        """Fetch and cache Supabase JWKS."""
        import time
        import json
        import logging
        from urllib.request import urlopen
        
        logger = logging.getLogger(__name__)
        
        global _jwks_cache, _jwks_cache_time
        
        current_time = time.time()
        if _jwks_cache and (current_time - _jwks_cache_time) < JWKS_CACHE_TTL:
            return _jwks_cache
        
        if not settings.supabase_url:
            raise ValueError("SUPABASE_URL is not configured")
        
        jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
        logger.info(f"Fetching JWKS from: {jwks_url}")
        
        with urlopen(jwks_url, timeout=10) as response:
            _jwks_cache = json.loads(response.read().decode("utf-8"))
            _jwks_cache_time = current_time
        
        logger.info(f"JWKS fetched, keys count: {len(_jwks_cache.get('keys', []))}")
        return _jwks_cache
    
    def _verify_cognito_token(self, token: str) -> dict:
        """
        Verify Cognito JWT token (RS256).
        
        Uses public key from JWKS for verification.
        """
        # Get public key for this token
        public_key = get_cognito_public_key(token)
        if not public_key:
            raise JWTError("Unable to find public key for token")
        
        # Expected issuer
        issuer = (
            f"https://cognito-idp.{settings.cognito_region}.amazonaws.com/"
            f"{settings.cognito_user_pool_id}"
        )
        
        # Verify token
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=settings.cognito_client_id,
            issuer=issuer,
            options={
                "verify_aud": True,
                "verify_exp": True,
                "verify_iss": True,
            }
        )
        
        # Verify token_use claim
        token_use = payload.get("token_use")
        if token_use not in ["id", "access"]:
            raise JWTError("Invalid token_use claim")
        
        return payload


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
    
    Works with both Supabase and Cognito tokens.
    
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


def get_user_email(request: Request) -> Optional[str]:
    """
    Dependency to get current user's email from request state.
    
    Works with both Supabase and Cognito tokens.
    """
    user = get_current_user(request)
    return user.get("email")
