/**
 * Structured Logger Module
 *
 * CloudWatch向けの構造化ログを出力するロガー。
 * Lambda実行コンテキストを自動的に含める。
 *
 * Requirements:
 * - 5.1: Supabase_Clientが初期化される時、クライアント作成のタイムスタンプとインスタンスIDをログ出力する
 * - 5.2: 接続エラーが発生する時、エラータイプ、リトライ回数、経過時間を構造化ログで出力する
 * - 5.3: リトライが実行される時、各リトライの試行番号と待機時間をログ出力する
 */
/**
 * Log levels supported by the structured logger.
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
/**
 * Lambda execution context interface.
 */
export interface LambdaContext {
    awsRequestId?: string;
    functionName?: string;
    functionVersion?: string;
    memoryLimitInMB?: number;
    invokedFunctionArn?: string;
    getRemainingTimeInMillis?: () => number;
}
/**
 * CloudWatch向け構造化ログを出力するロガー。
 * Lambda実行コンテキストを自動的に含める。
 */
export declare class StructuredLogger {
    private readonly name;
    private lambdaContext;
    private level;
    /**
     * StructuredLoggerを初期化する。
     *
     * @param name - ロガー名（通常はモジュール名）
     * @param lambdaContext - AWS Lambda実行コンテキスト（オプション）
     * @param level - ログレベル（デフォルト: INFO）
     */
    constructor(name: string, lambdaContext?: LambdaContext | null, level?: LogLevel);
    /**
     * Lambda実行コンテキストを設定する。
     */
    setLambdaContext(context: LambdaContext): void;
    /**
     * DEBUG レベルの構造化ログを出力。
     */
    debug(message: string, extra?: Record<string, unknown>): void;
    /**
     * INFO レベルの構造化ログを出力。
     */
    info(message: string, extra?: Record<string, unknown>): void;
    /**
     * WARNING レベルの構造化ログを出力。
     */
    warning(message: string, extra?: Record<string, unknown>): void;
    /**
     * ERROR レベルの構造化ログを出力。
     */
    error(message: string, error?: Error, extra?: Record<string, unknown>): void;
    /**
     * クライアント初期化をログ出力する。
     *
     * Requirement 5.1: クライアント作成のタイムスタンプとインスタンスIDをログ出力する
     */
    logClientInitialization(instanceId: string, clientType?: string, extra?: Record<string, unknown>): void;
    /**
     * 接続エラーをログ出力する。
     *
     * Requirement 5.2: エラータイプ、リトライ回数、経過時間を構造化ログで出力する
     */
    logConnectionError(error: Error, retryCount: number, elapsedTimeMs: number, extra?: Record<string, unknown>): void;
    /**
     * リトライ試行をログ出力する。
     *
     * Requirement 5.3: 各リトライの試行番号と待機時間をログ出力する
     */
    logRetryAttempt(attempt: number, maxAttempts: number, delayMs: number, errorType: string, extra?: Record<string, unknown>): void;
    /**
     * Slackコマンド処理をログ出力する。
     */
    logSlackCommand(command: string, processingTimeMs: number, resultStatus: string, requestId?: string, extra?: Record<string, unknown>): void;
    /**
     * ログレベルに基づいてログを出力すべきか判定する。
     */
    private shouldLog;
    /**
     * 構造化ログをJSON形式で出力する。
     */
    private log;
    /**
     * Lambda実行コンテキストから情報を抽出する。
     */
    private getLambdaContextInfo;
}
/**
 * StructuredLoggerインスタンスを取得するファクトリ関数。
 *
 * @param name - ロガー名（通常はモジュール名）
 * @param lambdaContext - AWS Lambda実行コンテキスト（オプション）
 * @returns StructuredLoggerインスタンス
 */
export declare function getLogger(name: string, lambdaContext?: LambdaContext | null): StructuredLogger;
//# sourceMappingURL=logger.d.ts.map