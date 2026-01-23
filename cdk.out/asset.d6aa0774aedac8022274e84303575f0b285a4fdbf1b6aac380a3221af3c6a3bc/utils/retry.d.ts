/**
 * Retry Logic Module
 *
 * 指数バックオフでリトライするユーティリティを提供する。
 *
 * Requirements:
 * - 11.1: 接続エラーで失敗した場合、指数バックオフで最大3回リトライする
 * - 11.2: リトライ間隔は100ms、200ms、400msの指数バックオフを適用する
 */
/**
 * リトライ設定。
 */
export interface RetryConfig {
    /**
     * 最大リトライ回数（デフォルト: 3）
     */
    maxRetries: number;
    /**
     * 基本遅延時間（ミリ秒）（デフォルト: 100）
     */
    baseDelayMs: number;
    /**
     * 最大遅延時間（ミリ秒）（デフォルト: 1000）
     */
    maxDelayMs: number;
    /**
     * リトライ対象のエラーを判定する関数
     */
    isRetryable?: (error: unknown) => boolean;
}
/**
 * デフォルトのリトライ設定。
 */
export declare const DEFAULT_RETRY_CONFIG: RetryConfig;
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
export declare function calculateDelay(attempt: number, config?: RetryConfig): number;
/**
 * エラーがリトライ可能かどうかを判定するデフォルト関数。
 *
 * 接続タイムアウト、接続リセット、一時的なネットワークエラーをリトライ対象とする。
 */
export declare function defaultIsRetryable(error: unknown): boolean;
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
export declare function withRetry<T>(fn: () => Promise<T>, config?: Partial<RetryConfig>): Promise<T>;
/**
 * リトライ可能なエラーかどうかを判定するユーティリティ関数。
 */
export declare function isRetryableError(error: unknown, config?: Partial<RetryConfig>): boolean;
//# sourceMappingURL=retry.d.ts.map