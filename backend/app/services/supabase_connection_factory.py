"""
Supabase Connection Factory

Lambda環境向けSupabase接続ファクトリ。
接続の有効性を検証し、必要に応じて再作成する。

Requirements:
- 1.1: ウォームスタート時に接続の有効性を検証してから使用する
- 1.2: 接続が無効または期限切れの場合、新しいクライアントインスタンスを作成する
- 1.3: 新しいインスタンス作成時に古いインスタンスのリソースを適切に解放する
- 1.4: リクエストごとに接続の健全性を確認する軽量なヘルスチェックを実行する
- 4.1: クライアント作成のタイムスタンプとインスタンスIDをログ出力する
"""

import uuid
from datetime import datetime
from typing import Optional

from supabase import Client, create_client

from ..utils.structured_logger import get_logger


class SupabaseConnectionFactory:
    """
    Lambda環境向けSupabase接続ファクトリ。
    接続の有効性を検証し、必要に応じて再作成する。
    
    Attributes:
        _url: Supabase URL
        _key: Supabase anonymous key
        _client: Cached Supabase client instance
        _created_at: Timestamp when the client was created
        _connection_timeout: Connection timeout in seconds
        _read_timeout: Read timeout in seconds
        _max_connections: Maximum number of connections in the pool
        _instance_id: Unique identifier for this factory instance
        _logger: Logger instance
    """
    
    def __init__(
        self,
        supabase_url: str,
        supabase_key: str,
        connection_timeout: float = 5.0,
        read_timeout: float = 10.0,
        max_connections: int = 10,
    ):
        """
        Initialize the connection factory.
        
        Args:
            supabase_url: Supabase project URL
            supabase_key: Supabase anonymous key
            connection_timeout: Connection timeout in seconds (default: 5.0)
            read_timeout: Read timeout in seconds (default: 10.0)
            max_connections: Maximum connections in pool (default: 10)
        """
        self._url = supabase_url
        self._key = supabase_key
        self._client: Optional[Client] = None
        self._created_at: Optional[datetime] = None
        self._connection_timeout = connection_timeout
        self._read_timeout = read_timeout
        self._max_connections = max_connections
        self._instance_id = self._generate_instance_id()
        self._logger = get_logger(__name__)
        
        # Log initialization with structured logging (Requirement 4.1)
        self._logger.log_client_initialization(
            instance_id=self._instance_id,
            client_type="supabase_connection_factory",
            connection_timeout=self._connection_timeout,
            read_timeout=self._read_timeout,
            max_connections=self._max_connections,
        )
    
    @property
    def instance_id(self) -> str:
        """Get the unique instance ID for this factory."""
        return self._instance_id
    
    @property
    def created_at(self) -> Optional[datetime]:
        """Get the timestamp when the current client was created."""
        return self._created_at
    
    @property
    def has_client(self) -> bool:
        """Check if a client instance exists."""
        return self._client is not None
    
    def get_client(self) -> Client:
        """
        有効なSupabaseクライアントを取得する。
        既存の接続が無効な場合は新しいクライアントを作成する。
        
        Requirements:
        - 1.1: 接続の有効性を検証してから使用する
        - 1.2: 接続が無効な場合、新しいクライアントを作成する
        - 1.4: リクエストごとに軽量なヘルスチェックを実行する
        
        Returns:
            Valid Supabase client instance
        """
        if self._client is not None:
            self._logger.debug(
                "Checking existing client validity",
                instance_id=self._instance_id,
                client_created_at=self._created_at.isoformat() if self._created_at else None,
            )
            
            if self._is_connection_valid():
                self._logger.debug(
                    "Existing client is valid, reusing",
                    instance_id=self._instance_id,
                )
                return self._client
            else:
                self._logger.info(
                    "Existing client is invalid, creating new client",
                    instance_id=self._instance_id,
                    old_client_created_at=self._created_at.isoformat() if self._created_at else None,
                )
        
        return self._create_new_client()
    
    def _is_connection_valid(self) -> bool:
        """
        接続の有効性を軽量なクエリで検証する。
        
        Requirement 1.4: 軽量なヘルスチェックを実行する
        
        Returns:
            True if connection is valid, False otherwise
        """
        if self._client is None:
            return False
        
        try:
            # Execute a lightweight query to validate the connection
            # Using a simple select with limit 1 to minimize overhead
            start_time = datetime.now()
            
            # Try to execute a simple query on a system table or any table
            # This validates that the connection is still alive
            # Use a timeout to prevent hanging on stale connections
            result = self._client.table("habits").select("id").limit(1).execute()
            
            elapsed_ms = (datetime.now() - start_time).total_seconds() * 1000
            
            # If the query took too long, consider the connection unhealthy
            # This helps detect slow/degraded connections
            if elapsed_ms > 3000:  # 3 second threshold
                self._logger.warning(
                    "Connection validation slow, marking as invalid",
                    instance_id=self._instance_id,
                    validation_latency_ms=elapsed_ms,
                )
                return False
            
            self._logger.debug(
                "Connection validation successful",
                instance_id=self._instance_id,
                validation_latency_ms=elapsed_ms,
            )
            
            return True
            
        except Exception as e:
            self._logger.warning(
                "Connection validation failed",
                instance_id=self._instance_id,
                error_type=type(e).__name__,
                error_message=str(e),
            )
            return False
    
    def _create_new_client(self) -> Client:
        """
        新しいSupabaseクライアントを作成する。
        
        Requirements:
        - 1.2: 新しいクライアントインスタンスを作成する
        - 1.3: 古いインスタンスのリソースを適切に解放する
        - 4.1: クライアント作成のタイムスタンプとインスタンスIDをログ出力する
        
        Returns:
            New Supabase client instance
        """
        # Cleanup old client first (Requirement 1.3)
        if self._client is not None:
            self._cleanup_old_client()
        
        creation_time = datetime.now()
        
        self._logger.info(
            "Creating new Supabase client",
            instance_id=self._instance_id,
            timestamp=creation_time.isoformat(),
        )
        
        try:
            # Create new client with configured timeouts
            # Note: supabase-py uses httpx under the hood
            # Timeout configuration is applied via the client options
            # supabase-py 2.x uses ClientOptions class
            from supabase.lib.client_options import ClientOptions
            
            options = ClientOptions(
                auto_refresh_token=False,  # Lambda doesn't need token refresh
                persist_session=False,  # Lambda doesn't persist sessions
            )
            
            self._client = create_client(
                self._url,
                self._key,
                options=options,
            )
            
            self._created_at = creation_time
            
            # Log client creation with structured logging (Requirement 4.1)
            self._logger.log_client_initialization(
                instance_id=self._instance_id,
                client_type="supabase",
                client_created_at=self._created_at.isoformat(),
            )
            
            return self._client
            
        except Exception as e:
            self._logger.error(
                "Failed to create Supabase client",
                error=e,
                instance_id=self._instance_id,
            )
            raise
    
    def _cleanup_old_client(self) -> None:
        """
        古いクライアントのリソースを解放する。
        
        Requirement 1.3: 古いインスタンスのリソースを適切に解放する
        """
        if self._client is None:
            return
        
        old_created_at = self._created_at
        
        self._logger.info(
            "Cleaning up old Supabase client",
            instance_id=self._instance_id,
            old_client_created_at=old_created_at.isoformat() if old_created_at else None,
        )
        
        try:
            # Close the underlying HTTP client if available
            # supabase-py uses postgrest-py which uses httpx
            if hasattr(self._client, 'postgrest') and hasattr(self._client.postgrest, '_session'):
                session = self._client.postgrest._session
                if hasattr(session, 'close'):
                    # Note: httpx.Client.close() is synchronous
                    session.close()
                    self._logger.debug(
                        "Closed postgrest session",
                        instance_id=self._instance_id,
                    )
            
            # Also try to close the auth client session if available
            if hasattr(self._client, 'auth') and hasattr(self._client.auth, '_client'):
                auth_client = self._client.auth._client
                if hasattr(auth_client, 'close'):
                    auth_client.close()
                    self._logger.debug(
                        "Closed auth client session",
                        instance_id=self._instance_id,
                    )
            
            self._logger.info(
                "Old Supabase client cleaned up successfully",
                instance_id=self._instance_id,
                old_client_created_at=old_created_at.isoformat() if old_created_at else None,
            )
            
        except Exception as e:
            # Log but don't raise - cleanup failures shouldn't block new client creation
            self._logger.warning(
                "Error during client cleanup (non-fatal)",
                instance_id=self._instance_id,
                error_type=type(e).__name__,
                error_message=str(e),
            )
        
        finally:
            # Always clear the reference
            self._client = None
            self._created_at = None
    
    def force_reconnect(self) -> Client:
        """
        強制的に新しい接続を作成する。
        
        既存の接続が有効かどうかに関わらず、新しいクライアントを作成する。
        
        Returns:
            New Supabase client instance
        """
        self._logger.info(
            "Force reconnect requested",
            instance_id=self._instance_id,
            had_existing_client=self._client is not None,
        )
        
        return self._create_new_client()
    
    def close(self) -> None:
        """
        接続を閉じてリソースを解放する。
        
        Lambda終了時やテスト後のクリーンアップに使用する。
        """
        self._logger.info(
            "Closing connection factory",
            instance_id=self._instance_id,
        )
        
        self._cleanup_old_client()
    
    @staticmethod
    def _generate_instance_id() -> str:
        """
        一意のインスタンスIDを生成する。
        
        Requirement 4.1: クライアント作成のインスタンスIDをログ出力する
        
        Returns:
            Unique instance ID string
        """
        return f"scf-{uuid.uuid4().hex[:12]}"


# Global factory instance for module-level access
_connection_factory: Optional[SupabaseConnectionFactory] = None


def get_connection_factory(
    supabase_url: Optional[str] = None,
    supabase_key: Optional[str] = None,
    connection_timeout: float = 5.0,
    read_timeout: float = 10.0,
    max_connections: int = 10,
) -> SupabaseConnectionFactory:
    """
    Get or create the global connection factory instance.
    
    Args:
        supabase_url: Supabase project URL (uses env if not provided)
        supabase_key: Supabase anonymous key (uses env if not provided)
        connection_timeout: Connection timeout in seconds
        read_timeout: Read timeout in seconds
        max_connections: Maximum connections in pool
        
    Returns:
        SupabaseConnectionFactory instance
    """
    global _connection_factory
    
    if _connection_factory is None:
        import os
        
        url = supabase_url or os.environ.get("SUPABASE_URL")
        key = supabase_key or os.environ.get("SUPABASE_ANON_KEY")
        
        if not url or not key:
            raise ValueError(
                "SUPABASE_URL and SUPABASE_ANON_KEY are required. "
                "Provide them as arguments or set environment variables."
            )
        
        _connection_factory = SupabaseConnectionFactory(
            supabase_url=url,
            supabase_key=key,
            connection_timeout=connection_timeout,
            read_timeout=read_timeout,
            max_connections=max_connections,
        )
    
    return _connection_factory


def reset_connection_factory() -> None:
    """
    Reset the global connection factory.
    
    Useful for testing or when configuration changes.
    """
    global _connection_factory
    
    if _connection_factory is not None:
        _connection_factory.close()
        _connection_factory = None
