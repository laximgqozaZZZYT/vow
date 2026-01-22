"""
Structured Logger Module

CloudWatch向けの構造化ログを出力するロガー。
Lambda実行コンテキストを自動的に含める。

Requirements:
- 4.1: Supabase_Clientが初期化される時、クライアント作成のタイムスタンプとインスタンスIDをログ出力する
- 4.2: 接続エラーが発生する時、エラータイプ、リトライ回数、経過時間を構造化ログで出力する
- 4.3: リトライが実行される時、各リトライの試行番号と待機時間をログ出力する
- 4.4: Slackコマンドが処理される時、リクエストID、処理時間、結果ステータスを含む構造化ログを出力する
- 4.5: Lambda実行コンテキスト（リクエストID、残り実行時間）をログに含める
"""

import json
import logging
import sys
import traceback
from datetime import datetime, timezone
from typing import Any, Dict, Optional


class StructuredLogger:
    """
    CloudWatch向け構造化ログを出力するロガー。
    Lambda実行コンテキストを自動的に含める。
    
    Usage:
        # Basic usage
        logger = StructuredLogger("my_module")
        logger.info("Processing started", user_id="123")
        
        # With Lambda context
        def lambda_handler(event, context):
            logger = StructuredLogger("handler", lambda_context=context)
            logger.info("Request received")
    
    Requirements:
    - 4.5: Lambda実行コンテキスト（リクエストID、残り実行時間）をログに含める
    """
    
    def __init__(
        self,
        name: str,
        lambda_context: Optional[Any] = None,
        level: int = logging.INFO,
    ):
        """
        StructuredLoggerを初期化する。
        
        Args:
            name: ロガー名（通常はモジュール名）
            lambda_context: AWS Lambda実行コンテキスト（オプション）
            level: ログレベル（デフォルト: INFO）
        """
        self._logger = logging.getLogger(name)
        self._logger.setLevel(level)
        self._lambda_context = lambda_context
        self._name = name
        
        # Ensure we have a handler that outputs to stdout for CloudWatch
        if not self._logger.handlers:
            handler = logging.StreamHandler(sys.stdout)
            handler.setLevel(level)
            # Use a simple formatter since we're outputting JSON
            handler.setFormatter(logging.Formatter("%(message)s"))
            self._logger.addHandler(handler)
            # Prevent propagation to root logger to avoid duplicate logs
            self._logger.propagate = False
    
    def set_lambda_context(self, context: Any) -> None:
        """
        Lambda実行コンテキストを設定する。
        
        Args:
            context: AWS Lambda実行コンテキスト
            
        Requirement 4.5: Lambda実行コンテキストをログに含める
        """
        self._lambda_context = context
    
    def debug(self, message: str, **kwargs: Any) -> None:
        """
        DEBUG レベルの構造化ログを出力。
        
        Args:
            message: ログメッセージ
            **kwargs: 追加のコンテキスト情報
        """
        log_entry = self._format_log("DEBUG", message, **kwargs)
        self._logger.debug(log_entry)
    
    def info(self, message: str, **kwargs: Any) -> None:
        """
        INFO レベルの構造化ログを出力。
        
        Args:
            message: ログメッセージ
            **kwargs: 追加のコンテキスト情報
            
        Requirement 4.1: クライアント作成のタイムスタンプとインスタンスIDをログ出力する
        Requirement 4.4: リクエストID、処理時間、結果ステータスを含む構造化ログを出力する
        """
        log_entry = self._format_log("INFO", message, **kwargs)
        self._logger.info(log_entry)
    
    def warning(self, message: str, **kwargs: Any) -> None:
        """
        WARNING レベルの構造化ログを出力。
        
        Args:
            message: ログメッセージ
            **kwargs: 追加のコンテキスト情報
            
        Requirement 4.3: 各リトライの試行番号と待機時間をログ出力する
        """
        log_entry = self._format_log("WARNING", message, **kwargs)
        self._logger.warning(log_entry)
    
    def error(
        self,
        message: str,
        error: Optional[Exception] = None,
        **kwargs: Any,
    ) -> None:
        """
        ERROR レベルの構造化ログを出力。
        
        Args:
            message: ログメッセージ
            error: 例外オブジェクト（オプション）
            **kwargs: 追加のコンテキスト情報
            
        Requirement 4.2: エラータイプ、リトライ回数、経過時間を構造化ログで出力する
        """
        if error is not None:
            kwargs["error_type"] = type(error).__name__
            kwargs["error_message"] = str(error)
            kwargs["error_traceback"] = traceback.format_exc()
        
        log_entry = self._format_log("ERROR", message, **kwargs)
        self._logger.error(log_entry)
    
    def _format_log(self, level: str, message: str, **kwargs: Any) -> str:
        """
        構造化ログをJSON形式でフォーマット。
        
        Args:
            level: ログレベル
            message: ログメッセージ
            **kwargs: 追加のコンテキスト情報
            
        Returns:
            JSON形式の構造化ログ文字列
            
        Requirements:
        - 4.1: タイムスタンプとインスタンスIDを含める
        - 4.5: Lambda実行コンテキスト（リクエストID、残り実行時間）をログに含める
        """
        log_entry: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": level,
            "logger": self._name,
            "message": message,
        }
        
        # Add Lambda context if available (Requirement 4.5)
        if self._lambda_context is not None:
            log_entry["lambda_context"] = self._get_lambda_context_info()
        
        # Add any additional context
        if kwargs:
            log_entry["extra"] = kwargs
        
        return json.dumps(log_entry, ensure_ascii=False, default=str)
    
    def _get_lambda_context_info(self) -> Dict[str, Any]:
        """
        Lambda実行コンテキストから情報を抽出する。
        
        Returns:
            Lambda実行コンテキスト情報の辞書
            
        Requirement 4.5: Lambda実行コンテキスト（リクエストID、残り実行時間）をログに含める
        """
        context_info: Dict[str, Any] = {}
        
        if self._lambda_context is None:
            return context_info
        
        # Extract request ID
        if hasattr(self._lambda_context, "aws_request_id"):
            context_info["request_id"] = self._lambda_context.aws_request_id
        
        # Extract remaining time in milliseconds
        if hasattr(self._lambda_context, "get_remaining_time_in_millis"):
            try:
                context_info["remaining_time_ms"] = (
                    self._lambda_context.get_remaining_time_in_millis()
                )
            except Exception:
                # Ignore errors when getting remaining time
                pass
        
        # Extract function name
        if hasattr(self._lambda_context, "function_name"):
            context_info["function_name"] = self._lambda_context.function_name
        
        # Extract function version
        if hasattr(self._lambda_context, "function_version"):
            context_info["function_version"] = self._lambda_context.function_version
        
        # Extract memory limit
        if hasattr(self._lambda_context, "memory_limit_in_mb"):
            context_info["memory_limit_mb"] = self._lambda_context.memory_limit_in_mb
        
        # Extract invoked function ARN
        if hasattr(self._lambda_context, "invoked_function_arn"):
            context_info["invoked_function_arn"] = (
                self._lambda_context.invoked_function_arn
            )
        
        return context_info
    
    # Convenience methods for specific logging scenarios
    
    def log_client_initialization(
        self,
        instance_id: str,
        client_type: str = "supabase",
        **kwargs: Any,
    ) -> None:
        """
        クライアント初期化をログ出力する。
        
        Args:
            instance_id: クライアントインスタンスID
            client_type: クライアントタイプ（デフォルト: "supabase"）
            **kwargs: 追加のコンテキスト情報
            
        Requirement 4.1: クライアント作成のタイムスタンプとインスタンスIDをログ出力する
        """
        self.info(
            f"{client_type} client initialized",
            instance_id=instance_id,
            client_type=client_type,
            created_at=datetime.now(timezone.utc).isoformat(),
            **kwargs,
        )
    
    def log_connection_error(
        self,
        error: Exception,
        retry_count: int,
        elapsed_time_ms: float,
        **kwargs: Any,
    ) -> None:
        """
        接続エラーをログ出力する。
        
        Args:
            error: 発生した例外
            retry_count: リトライ回数
            elapsed_time_ms: 経過時間（ミリ秒）
            **kwargs: 追加のコンテキスト情報
            
        Requirement 4.2: エラータイプ、リトライ回数、経過時間を構造化ログで出力する
        """
        self.error(
            "Connection error occurred",
            error=error,
            retry_count=retry_count,
            elapsed_time_ms=elapsed_time_ms,
            **kwargs,
        )
    
    def log_retry_attempt(
        self,
        attempt: int,
        max_attempts: int,
        delay_ms: int,
        error_type: str,
        **kwargs: Any,
    ) -> None:
        """
        リトライ試行をログ出力する。
        
        Args:
            attempt: 現在の試行番号（1から開始）
            max_attempts: 最大試行回数
            delay_ms: 待機時間（ミリ秒）
            error_type: エラータイプ
            **kwargs: 追加のコンテキスト情報
            
        Requirement 4.3: 各リトライの試行番号と待機時間をログ出力する
        """
        self.warning(
            f"Retry attempt {attempt}/{max_attempts}",
            attempt=attempt,
            max_attempts=max_attempts,
            delay_ms=delay_ms,
            error_type=error_type,
            **kwargs,
        )
    
    def log_slack_command(
        self,
        command: str,
        processing_time_ms: float,
        result_status: str,
        request_id: Optional[str] = None,
        **kwargs: Any,
    ) -> None:
        """
        Slackコマンド処理をログ出力する。
        
        Args:
            command: 実行されたコマンド
            processing_time_ms: 処理時間（ミリ秒）
            result_status: 結果ステータス（"success", "error", "not_found"）
            request_id: リクエストID（オプション）
            **kwargs: 追加のコンテキスト情報
            
        Requirement 4.4: リクエストID、処理時間、結果ステータスを含む構造化ログを出力する
        """
        log_kwargs: Dict[str, Any] = {
            "command": command,
            "processing_time_ms": processing_time_ms,
            "result_status": result_status,
            **kwargs,
        }
        
        if request_id is not None:
            log_kwargs["request_id"] = request_id
        
        self.info(
            f"Slack command processed: {command}",
            **log_kwargs,
        )


def get_logger(
    name: str,
    lambda_context: Optional[Any] = None,
) -> StructuredLogger:
    """
    StructuredLoggerインスタンスを取得するファクトリ関数。
    
    Args:
        name: ロガー名（通常はモジュール名）
        lambda_context: AWS Lambda実行コンテキスト（オプション）
        
    Returns:
        StructuredLoggerインスタンス
        
    Usage:
        from app.utils.structured_logger import get_logger
        
        logger = get_logger(__name__)
        logger.info("Hello, world!")
    """
    return StructuredLogger(name, lambda_context=lambda_context)
