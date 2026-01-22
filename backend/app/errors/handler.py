"""
Centralized Error Handler Module

FastAPI用の集中エラーハンドラー。
アプリケーションエラーを構造化ログで記録し、適切なJSONレスポンスを返す。

Requirements:
- 4.4: Slackハンドラーでエラーが発生した場合、ユーザーフレンドリーな日本語メッセージを返す
- 4.5: 技術的なエラー詳細はユーザー向けメッセージとは別にログに記録する
- 4.6: 一貫したエラーレスポンスのために集中エラーハンドラーを使用する
"""

from fastapi import Request
from fastapi.responses import JSONResponse

from . import (
    AppError,
    ConnectionError,
    DataFetchError,
    RateLimitError,
    SlackAPIError,
)
from ..utils.structured_logger import get_logger

logger = get_logger(__name__)


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """
    Handle application errors with structured logging.
    
    アプリケーションエラーを構造化ログで記録し、
    適切なHTTPステータスコードとエラーメッセージを含むJSONレスポンスを返す。
    
    Args:
        request: FastAPIリクエストオブジェクト
        exc: 発生したAppErrorまたはそのサブクラス
        
    Returns:
        JSONResponse: エラーコードとメッセージを含むJSONレスポンス
        
    Requirements:
    - 4.5: 技術的なエラー詳細はユーザー向けメッセージとは別にログに記録する
    - 4.6: 一貫したエラーレスポンスのために集中エラーハンドラーを使用する
    """
    logger.error(
        f"Application error: {exc.message}",
        error_type=type(exc).__name__,
        error_code=exc.code,
        status_code=exc.status_code,
        path=request.url.path,
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.code or "ERROR",
            "message": exc.message,
        }
    )


def get_user_friendly_message(error: Exception) -> str:
    """
    Get user-friendly error message in Japanese.
    
    エラータイプに基づいて、ユーザーフレンドリーな日本語メッセージを返す。
    技術的な詳細は含めず、ユーザーが理解しやすいメッセージを提供する。
    
    Args:
        error: 発生した例外
        
    Returns:
        str: ユーザーフレンドリーな日本語エラーメッセージ
        
    Requirements:
    - 4.4: Slackハンドラーでエラーが発生した場合、ユーザーフレンドリーな日本語メッセージを返す
    """
    if isinstance(error, DataFetchError):
        return "データの取得に失敗しました。しばらくしてからもう一度お試しください。"
    if isinstance(error, ConnectionError):
        return "接続エラーが発生しました。しばらくしてからもう一度お試しください。"
    if isinstance(error, RateLimitError):
        return "リクエストが多すぎます。しばらくしてからもう一度お試しください。"
    if isinstance(error, SlackAPIError):
        return "Slack APIエラーが発生しました。しばらくしてからもう一度お試しください。"
    return "予期しないエラーが発生しました。しばらくしてからもう一度お試しください。"
