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
 * CloudWatch向け構造化ログを出力するロガー。
 * Lambda実行コンテキストを自動的に含める。
 */
export class StructuredLogger {
    name;
    lambdaContext;
    level;
    /**
     * StructuredLoggerを初期化する。
     *
     * @param name - ロガー名（通常はモジュール名）
     * @param lambdaContext - AWS Lambda実行コンテキスト（オプション）
     * @param level - ログレベル（デフォルト: INFO）
     */
    constructor(name, lambdaContext = null, level = 'INFO') {
        this.name = name;
        this.lambdaContext = lambdaContext;
        this.level = level;
    }
    /**
     * Lambda実行コンテキストを設定する。
     */
    setLambdaContext(context) {
        this.lambdaContext = context;
    }
    /**
     * DEBUG レベルの構造化ログを出力。
     */
    debug(message, extra) {
        if (this.shouldLog('DEBUG')) {
            this.log('DEBUG', message, extra);
        }
    }
    /**
     * INFO レベルの構造化ログを出力。
     */
    info(message, extra) {
        if (this.shouldLog('INFO')) {
            this.log('INFO', message, extra);
        }
    }
    /**
     * WARNING レベルの構造化ログを出力。
     */
    warning(message, extra) {
        if (this.shouldLog('WARNING')) {
            this.log('WARNING', message, extra);
        }
    }
    /**
     * ERROR レベルの構造化ログを出力。
     */
    error(message, error, extra) {
        if (this.shouldLog('ERROR')) {
            const errorExtra = { ...extra };
            if (error) {
                errorExtra['error_type'] = error.name;
                errorExtra['error_message'] = error.message;
                errorExtra['error_stack'] = error.stack;
            }
            this.log('ERROR', message, errorExtra);
        }
    }
    /**
     * クライアント初期化をログ出力する。
     *
     * Requirement 5.1: クライアント作成のタイムスタンプとインスタンスIDをログ出力する
     */
    logClientInitialization(instanceId, clientType = 'supabase', extra) {
        this.info(`${clientType} client initialized`, {
            instance_id: instanceId,
            client_type: clientType,
            created_at: new Date().toISOString(),
            ...extra,
        });
    }
    /**
     * 接続エラーをログ出力する。
     *
     * Requirement 5.2: エラータイプ、リトライ回数、経過時間を構造化ログで出力する
     */
    logConnectionError(error, retryCount, elapsedTimeMs, extra) {
        this.error('Connection error occurred', error, {
            retry_count: retryCount,
            elapsed_time_ms: elapsedTimeMs,
            ...extra,
        });
    }
    /**
     * リトライ試行をログ出力する。
     *
     * Requirement 5.3: 各リトライの試行番号と待機時間をログ出力する
     */
    logRetryAttempt(attempt, maxAttempts, delayMs, errorType, extra) {
        this.warning(`Retry attempt ${attempt}/${maxAttempts}`, {
            attempt,
            max_attempts: maxAttempts,
            delay_ms: delayMs,
            error_type: errorType,
            ...extra,
        });
    }
    /**
     * Slackコマンド処理をログ出力する。
     */
    logSlackCommand(command, processingTimeMs, resultStatus, requestId, extra) {
        const logExtra = {
            command,
            processing_time_ms: processingTimeMs,
            result_status: resultStatus,
            ...extra,
        };
        if (requestId) {
            logExtra['request_id'] = requestId;
        }
        this.info(`Slack command processed: ${command}`, logExtra);
    }
    /**
     * ログレベルに基づいてログを出力すべきか判定する。
     */
    shouldLog(level) {
        const levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR'];
        return levels.indexOf(level) >= levels.indexOf(this.level);
    }
    /**
     * 構造化ログをJSON形式で出力する。
     */
    log(level, message, extra) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            logger: this.name,
            message,
        };
        // Add Lambda context if available
        if (this.lambdaContext) {
            entry.lambda_context = this.getLambdaContextInfo();
        }
        // Add extra context
        if (extra && Object.keys(extra).length > 0) {
            entry.extra = extra;
        }
        // Output to console (CloudWatch captures stdout)
        const output = JSON.stringify(entry);
        if (level === 'ERROR') {
            console.error(output);
        }
        else if (level === 'WARNING') {
            console.warn(output);
        }
        else {
            console.log(output);
        }
    }
    /**
     * Lambda実行コンテキストから情報を抽出する。
     */
    getLambdaContextInfo() {
        const contextInfo = {};
        if (!this.lambdaContext) {
            return contextInfo;
        }
        if (this.lambdaContext.awsRequestId) {
            contextInfo['request_id'] = this.lambdaContext.awsRequestId;
        }
        if (this.lambdaContext.getRemainingTimeInMillis) {
            try {
                contextInfo['remaining_time_ms'] = this.lambdaContext.getRemainingTimeInMillis();
            }
            catch {
                // Ignore errors when getting remaining time
            }
        }
        if (this.lambdaContext.functionName) {
            contextInfo['function_name'] = this.lambdaContext.functionName;
        }
        if (this.lambdaContext.functionVersion) {
            contextInfo['function_version'] = this.lambdaContext.functionVersion;
        }
        if (this.lambdaContext.memoryLimitInMB) {
            contextInfo['memory_limit_mb'] = this.lambdaContext.memoryLimitInMB;
        }
        if (this.lambdaContext.invokedFunctionArn) {
            contextInfo['invoked_function_arn'] = this.lambdaContext.invokedFunctionArn;
        }
        return contextInfo;
    }
}
/**
 * StructuredLoggerインスタンスを取得するファクトリ関数。
 *
 * @param name - ロガー名（通常はモジュール名）
 * @param lambdaContext - AWS Lambda実行コンテキスト（オプション）
 * @returns StructuredLoggerインスタンス
 */
export function getLogger(name, lambdaContext = null) {
    return new StructuredLogger(name, lambdaContext);
}
//# sourceMappingURL=logger.js.map