/**
 * Retry Logic Module
 *
 * 指数バックオフでリトライするユーティリティを提供する。
 *
 * Requirements:
 * - 11.1: 接続エラーで失敗した場合、指数バックオフで最大3回リトライする
 * - 11.2: リトライ間隔は100ms、200ms、400msの指数バックオフを適用する
 */
import { getLogger } from './logger';
const logger = getLogger('retry');
/**
 * デフォルトのリトライ設定。
 */
export const DEFAULT_RETRY_CONFIG = {
    maxRetries: 3,
    baseDelayMs: 100,
    maxDelayMs: 1000,
};
/**
 * 指定されたリトライ試行回数に対する遅延時間を計算する。
 *
 * 指数バックオフ: baseDelayMs * (2 ^ attempt)
 * 例: attempt=0 -> 100ms, attempt=1 -> 200ms, attempt=2 -> 400ms
 *
 * @param attempt - リトライ試行回数（0から開始）
 * @param config - リトライ設定
 * @returns 遅延時間（ミリ秒）
 */
export function calculateDelay(attempt, config = DEFAULT_RETRY_CONFIG) {
    const delay = config.baseDelayMs * Math.pow(2, attempt);
    return Math.min(delay, config.maxDelayMs);
}
/**
 * エラーがリトライ可能かどうかを判定するデフォルト関数。
 *
 * 接続タイムアウト、接続リセット、一時的なネットワークエラーをリトライ対象とする。
 */
export function defaultIsRetryable(error) {
    if (!(error instanceof Error)) {
        return false;
    }
    // Check error name
    const retryableNames = [
        'ConnectionError',
        'TimeoutError',
        'NetworkError',
        'FetchError',
        'AbortError',
    ];
    if (retryableNames.includes(error.name)) {
        return true;
    }
    // Check error message for connection-related keywords
    const message = error.message.toLowerCase();
    const connectionKeywords = [
        'connection reset',
        'connection refused',
        'connection timed out',
        'broken pipe',
        'network unreachable',
        'no route to host',
        'connection aborted',
        'socket error',
        'read timed out',
        'connect timeout',
        'pool timeout',
        'econnreset',
        'econnrefused',
        'etimedout',
        'enetunreach',
        'ehostunreach',
        'fetch failed',
    ];
    if (connectionKeywords.some((keyword) => message.includes(keyword))) {
        return true;
    }
    // Check for HTTP status codes that indicate temporary issues
    if ('status' in error && typeof error.status === 'number') {
        const status = error.status;
        // 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout
        if ([502, 503, 504].includes(status)) {
            return true;
        }
    }
    // Check for cause (wrapped errors)
    if ('cause' in error && error.cause instanceof Error) {
        return defaultIsRetryable(error.cause);
    }
    return false;
}
/**
 * 指定されたミリ秒だけ待機する。
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * 指数バックオフでリトライする関数。
 *
 * @param fn - 実行する非同期関数
 * @param config - リトライ設定
 * @returns 関数の戻り値
 * @throws 最大リトライ回数を超えた場合、最後のエラーをスロー
 *
 * Requirements:
 * - 11.1: 接続エラーで失敗した場合、指数バックオフで最大3回リトライする
 * - 11.2: リトライ間隔は100ms、200ms、400msの指数バックオフを適用する
 */
export async function withRetry(fn, config = {}) {
    const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    const isRetryable = fullConfig.isRetryable ?? defaultIsRetryable;
    let lastError;
    for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            // Check if error is retryable
            if (!isRetryable(error)) {
                logger.warning('Non-retryable error, raising immediately', {
                    error_type: lastError.name,
                    error_message: lastError.message,
                    attempt: attempt + 1,
                });
                throw lastError;
            }
            // Check if we have retries left
            if (attempt >= fullConfig.maxRetries) {
                logger.error('All retries exhausted', lastError, {
                    total_attempts: attempt + 1,
                    max_retries: fullConfig.maxRetries,
                });
                throw lastError;
            }
            // Calculate delay and wait
            const delayMs = calculateDelay(attempt, fullConfig);
            logger.logRetryAttempt(attempt + 1, fullConfig.maxRetries, delayMs, lastError.name, {
                error_message: lastError.message,
            });
            await sleep(delayMs);
        }
    }
    // This should never be reached, but just in case
    if (lastError) {
        throw lastError;
    }
    throw new Error('Unexpected state in retry logic');
}
/**
 * リトライ可能なエラーかどうかを判定するユーティリティ関数。
 */
export function isRetryableError(error, config) {
    const isRetryable = config?.isRetryable ?? defaultIsRetryable;
    return isRetryable(error);
}
//# sourceMappingURL=retry.js.map