"""
Slack Error Handler Module

Slackコマンドのエラーをユーザーフレンドリーなメッセージに変換する。
技術的詳細はログに記録し、ユーザーには適切なメッセージのみを表示する。

Requirements:
- 3.1: データベース接続エラー時に「一時的な接続エラーが発生しました。しばらくしてから再度お試しください。」と表示
- 3.2: Habit/Activity情報の取得失敗時に「データの取得に失敗しました」と表示
- 3.3: エラーの種類に応じた適切なSlackブロックメッセージを返却
- 3.4: エラー詳細をログに記録しつつユーザーには技術的詳細を隠す
"""

from enum import Enum
from typing import Any, Dict, List, Optional

from app.utils.structured_logger import get_logger


class ErrorType(Enum):
    """エラータイプの分類。"""
    CONNECTION_ERROR = "connection_error"
    DATA_FETCH_ERROR = "data_fetch_error"
    VALIDATION_ERROR = "validation_error"
    UNKNOWN_ERROR = "unknown_error"


class DataFetchError(Exception):
    """データ取得エラーを表すカスタム例外。"""
    
    def __init__(self, message: str, original_error: Optional[Exception] = None):
        super().__init__(message)
        self.original_error = original_error


class SlackErrorHandler:
    """
    Slackコマンドのエラーをユーザーフレンドリーなメッセージに変換する。
    
    技術的詳細はCloudWatchログに記録し、ユーザーには
    理解しやすいメッセージのみを表示する。
    
    Usage:
        try:
            result = await fetch_habits(owner_id)
        except Exception as e:
            return SlackErrorHandler.handle_error(e)
    
    Requirements:
    - 3.1: 接続エラー時のユーザーフレンドリーメッセージ
    - 3.2: データ取得失敗時の適切なメッセージ
    - 3.3: エラー種類に応じたSlackブロックメッセージ
    - 3.4: 技術的詳細のログ記録とユーザーへの非表示
    """
    
    # エラータイプごとのユーザーフレンドリーメッセージ
    ERROR_MESSAGES: Dict[ErrorType, str] = {
        ErrorType.CONNECTION_ERROR: (
            "一時的な接続エラーが発生しました。"
            "しばらくしてから再度お試しください。"
        ),
        ErrorType.DATA_FETCH_ERROR: (
            "データの取得に失敗しました。"
            "しばらくしてから再度お試しください。"
        ),
        ErrorType.VALIDATION_ERROR: "入力内容に問題があります。",
        ErrorType.UNKNOWN_ERROR: "予期しないエラーが発生しました。",
    }
    
    # 接続関連の例外タイプ
    CONNECTION_ERROR_TYPES = (
        ConnectionError,
        ConnectionResetError,
        ConnectionRefusedError,
        ConnectionAbortedError,
        BrokenPipeError,
        TimeoutError,
        OSError,  # Network unreachable等
    )
    
    # 接続エラーを示すエラーメッセージのキーワード
    CONNECTION_ERROR_KEYWORDS = (
        "connection",
        "timeout",
        "timed out",
        "network",
        "unreachable",
        "refused",
        "reset",
        "broken pipe",
        "ssl",
        "certificate",
        "handshake",
    )
    
    # データ取得エラーを示すキーワード
    DATA_FETCH_ERROR_KEYWORDS = (
        "fetch",
        "query",
        "select",
        "database",
        "supabase",
        "postgrest",
        "relation",
        "column",
    )
    
    # バリデーションエラーを示すキーワード
    VALIDATION_ERROR_KEYWORDS = (
        "validation",
        "invalid",
        "required",
        "missing",
        "format",
        "type error",
        "value error",
    )
    
    _logger = get_logger(__name__)
    
    @classmethod
    def handle_error(
        cls,
        error: Exception,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        例外をSlackブロックメッセージに変換する。
        
        技術的詳細はログに記録し、ユーザーには
        フレンドリーなメッセージのみを返却する。
        
        接続エラーの場合は、次回のリクエストで新しい接続が
        使用されるように接続ファクトリをリセットする。
        
        Args:
            error: 発生した例外
            context: 追加のコンテキスト情報（ログ用）
            
        Returns:
            Slackブロックメッセージを含む辞書
            
        Requirements:
        - 3.3: エラーの種類に応じた適切なSlackブロックメッセージを返却
        - 3.4: エラー詳細をログに記録しつつユーザーには技術的詳細を隠す
        """
        # エラータイプを分類
        error_type = cls.classify_error(error)
        
        # 技術的詳細をログに記録（Requirement 3.4）
        cls._log_error_details(error, error_type, context)
        
        # 接続エラーの場合は接続ファクトリをリセット
        # これにより次回のリクエストで新しい接続が作成される
        if error_type == ErrorType.CONNECTION_ERROR:
            cls._reset_connection_on_error()
        
        # ユーザーフレンドリーメッセージを取得
        user_message = cls.ERROR_MESSAGES.get(
            error_type,
            cls.ERROR_MESSAGES[ErrorType.UNKNOWN_ERROR],
        )
        
        # Slackブロックメッセージを生成（Requirement 3.3）
        return cls._build_error_blocks(user_message, error_type)
    
    @classmethod
    def _reset_connection_on_error(cls) -> None:
        """
        接続エラー発生時に接続ファクトリをリセットする。
        
        これにより、次回のリクエストで新しい接続が作成される。
        """
        try:
            from app.services.supabase_connection_factory import reset_connection_factory
            cls._logger.info(
                "Resetting connection factory due to connection error"
            )
            reset_connection_factory()
        except Exception as e:
            cls._logger.warning(
                "Failed to reset connection factory",
                error_type=type(e).__name__,
                error_message=str(e),
            )
    
    @classmethod
    def classify_error(cls, error: Exception) -> ErrorType:
        """
        例外の種類を分類する。
        
        Args:
            error: 分類する例外
            
        Returns:
            分類されたエラータイプ
            
        Requirements:
        - 3.1: データベース接続エラーの識別
        - 3.2: Habit/Activity情報取得失敗の識別
        """
        # DataFetchErrorは明示的にDATA_FETCH_ERRORとして分類
        if isinstance(error, DataFetchError):
            return ErrorType.DATA_FETCH_ERROR
        
        # 接続関連の例外タイプをチェック（Requirement 3.1）
        if isinstance(error, cls.CONNECTION_ERROR_TYPES):
            return ErrorType.CONNECTION_ERROR
        
        # ValueError, TypeErrorはバリデーションエラー
        if isinstance(error, (ValueError, TypeError)):
            return ErrorType.VALIDATION_ERROR
        
        # エラーメッセージからキーワードで分類
        error_message = str(error).lower()
        error_type_name = type(error).__name__.lower()
        combined_text = f"{error_message} {error_type_name}"
        
        # 接続エラーキーワードをチェック
        if any(kw in combined_text for kw in cls.CONNECTION_ERROR_KEYWORDS):
            return ErrorType.CONNECTION_ERROR
        
        # データ取得エラーキーワードをチェック（Requirement 3.2）
        if any(kw in combined_text for kw in cls.DATA_FETCH_ERROR_KEYWORDS):
            return ErrorType.DATA_FETCH_ERROR
        
        # バリデーションエラーキーワードをチェック
        if any(kw in combined_text for kw in cls.VALIDATION_ERROR_KEYWORDS):
            return ErrorType.VALIDATION_ERROR
        
        # 分類できない場合は不明なエラー
        return ErrorType.UNKNOWN_ERROR
    
    @classmethod
    def _log_error_details(
        cls,
        error: Exception,
        error_type: ErrorType,
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        エラーの技術的詳細をログに記録する。
        
        Args:
            error: 発生した例外
            error_type: 分類されたエラータイプ
            context: 追加のコンテキスト情報
            
        Requirement 3.4: エラー詳細をログに記録
        """
        log_context = {
            "error_type": error_type.value,
            "error_class": type(error).__name__,
            **(context or {}),
        }
        
        # DataFetchErrorの場合は元のエラーも記録
        if isinstance(error, DataFetchError) and error.original_error:
            log_context["original_error_class"] = type(error.original_error).__name__
            log_context["original_error_message"] = str(error.original_error)
        
        cls._logger.error(
            f"Slack command error: {error_type.value}",
            error=error,
            **log_context,
        )
    
    @classmethod
    def _build_error_blocks(
        cls,
        message: str,
        error_type: ErrorType,
    ) -> Dict[str, Any]:
        """
        エラーメッセージをSlackブロック形式に変換する。
        
        Args:
            message: ユーザーに表示するメッセージ
            error_type: エラータイプ（アイコン選択用）
            
        Returns:
            Slackブロックメッセージを含む辞書
            
        Requirement 3.3: エラーの種類に応じた適切なSlackブロックメッセージを返却
        """
        # エラータイプに応じたアイコンを選択
        icon = cls._get_error_icon(error_type)
        
        blocks: List[Dict[str, Any]] = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"{icon} {message}",
                },
            },
        ]
        
        return {
            "response_type": "ephemeral",
            "text": message,  # フォールバック用テキスト
            "blocks": blocks,
        }
    
    @classmethod
    def _get_error_icon(cls, error_type: ErrorType) -> str:
        """
        エラータイプに応じたアイコンを返す。
        
        Args:
            error_type: エラータイプ
            
        Returns:
            絵文字アイコン
        """
        icons = {
            ErrorType.CONNECTION_ERROR: "🔌",
            ErrorType.DATA_FETCH_ERROR: "📊",
            ErrorType.VALIDATION_ERROR: "⚠️",
            ErrorType.UNKNOWN_ERROR: "❌",
        }
        return icons.get(error_type, "❌")
    
    @classmethod
    def create_connection_error_response(cls) -> Dict[str, Any]:
        """
        接続エラー用のレスポンスを直接生成する。
        
        Returns:
            Slackブロックメッセージを含む辞書
            
        Requirement 3.1: 接続エラー時のユーザーフレンドリーメッセージ
        """
        return cls._build_error_blocks(
            cls.ERROR_MESSAGES[ErrorType.CONNECTION_ERROR],
            ErrorType.CONNECTION_ERROR,
        )
    
    @classmethod
    def create_data_fetch_error_response(cls) -> Dict[str, Any]:
        """
        データ取得エラー用のレスポンスを直接生成する。
        
        Returns:
            Slackブロックメッセージを含む辞書
            
        Requirement 3.2: データ取得失敗時のメッセージ
        """
        return cls._build_error_blocks(
            cls.ERROR_MESSAGES[ErrorType.DATA_FETCH_ERROR],
            ErrorType.DATA_FETCH_ERROR,
        )
    
    @classmethod
    def create_validation_error_response(
        cls,
        details: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        バリデーションエラー用のレスポンスを生成する。
        
        Args:
            details: 追加の詳細メッセージ（オプション）
            
        Returns:
            Slackブロックメッセージを含む辞書
        """
        message = cls.ERROR_MESSAGES[ErrorType.VALIDATION_ERROR]
        if details:
            message = f"{message}\n{details}"
        
        return cls._build_error_blocks(message, ErrorType.VALIDATION_ERROR)
