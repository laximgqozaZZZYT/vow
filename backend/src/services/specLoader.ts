/**
 * Spec Loader Service
 *
 * 外部マークダウンファイルからAIコーチの仕様を読み込み、
 * システムプロンプトを構築するサービス。
 *
 * Requirements:
 * - 1.1: THE Spec_Loader SHALL load spec documents from `backend/specs/ai-coach/` directory
 * - 1.2: WHEN the AI_Coach service initializes, THE Spec_Loader SHALL read and combine all spec markdown files
 * - 1.4: IF a spec file is missing, THEN THE Spec_Loader SHALL log a warning and use default values
 */

import { promises as fs } from 'fs';
import path from 'path';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('specLoader');

/**
 * 仕様ファイルの内容を保持するインターフェース
 */
export interface SpecContent {
  /** 役割定義 */
  role: string;
  /** ガードレール */
  guardrails: string;
  /** 会話ガイドライン */
  conversation: string;
  /** 習慣提案ガイドライン */
  habits: string;
  /** 応答フォーマット */
  responseFormat: string;
}

/**
 * 仕様ファイル名とSpecContentのキーのマッピング
 */
const SPEC_FILE_MAPPING: Record<keyof SpecContent, string> = {
  role: 'role.md',
  guardrails: 'guardrails.md',
  conversation: 'conversation.md',
  habits: 'habits.md',
  responseFormat: 'response-format.md',
};

/**
 * デフォルトの仕様内容（ファイルが見つからない場合に使用）
 */
const DEFAULT_SPECS: SpecContent = {
  role: `# AI Coach Role Definition

## Identity
- Name: Vowの習慣コーチ
- Personality: 温かく、励まし、実践的

## Primary Responsibilities
1. 習慣形成のサポート
2. 行動科学に基づいたアドバイス
3. データ分析と改善提案
4. 習慣の作成・編集支援`,

  guardrails: `# Guardrails

## Absolute Restrictions
- 医療診断・処方の提案禁止
- 法的アドバイス禁止
- 金融・投資アドバイス禁止
- 政治・宗教的意見の表明禁止

## Habit Safety Rules
- 危険な習慣の提案禁止
- 依存性行動の推奨禁止`,

  conversation: `# Conversation Guidelines

## Emotional Intelligence
- 挨拶への対応
- フラストレーションへの共感
- 小さな成功の祝福

## Clarification Strategy
- 最大2つの質問/ターン
- 合理的な仮定と確認
- 具体的な選択肢の提示`,

  habits: `# Habit Suggestion Guidelines

## Principles
- 2分ルール
- 習慣スタッキング
- 環境デザイン
- アイデンティティベース

## Tool Usage Rules
- 習慣作成意図の検出
- ツール使用のタイミング
- テキストのみの応答を避ける`,

  responseFormat: `# Response Format Guidelines

## Length Guidelines
- 簡単な確認: 200文字以下
- 分析結果: 箇条書き使用
- 複数選択肢: 番号付き

## Visual Elements
- 絵文字: 1-2個/応答
- 箇条書き: 3項目以上の場合

## Call-to-Action
- 常に次のステップを提示
- 質問で会話を続ける`,
};

/**
 * ファイル読み込みのリトライ設定
 */
const RETRY_CONFIG = {
  maxRetries: 1,
  retryDelayMs: 100,
};

/**
 * SpecLoaderクラス
 *
 * 仕様ファイルを読み込み、システムプロンプトを構築する
 */
export class SpecLoader {
  private cachedSpecs: SpecContent | null = null;
  private specDir: string;

  /**
   * SpecLoaderを初期化する
   *
   * @param specDir - 仕様ファイルのディレクトリパス（デフォルト: backend/specs/ai-coach）
   */
  constructor(specDir?: string) {
    // デフォルトのディレクトリパスを設定
    // Lambda環境では /var/task/specs/ai-coach になる
    this.specDir = specDir || this.getDefaultSpecDir();
  }

  /**
   * デフォルトの仕様ディレクトリパスを取得
   */
  private getDefaultSpecDir(): string {
    // Lambda環境かどうかを判定
    if (process.env['AWS_LAMBDA_FUNCTION_NAME']) {
      return '/var/task/specs/ai-coach';
    }
    // ローカル開発環境
    return path.resolve(process.cwd(), 'specs/ai-coach');
  }

  /**
   * 指定されたディレクトリから全ての仕様ファイルを読み込む
   *
   * @param specDir - 仕様ファイルのディレクトリパス（オプション）
   * @returns 仕様内容
   */
  async loadSpecs(specDir?: string): Promise<SpecContent> {
    const targetDir = specDir || this.specDir;

    logger.info('Loading spec files', { specDir: targetDir });

    // ディレクトリの存在確認
    const dirExists = await this.checkDirectoryExists(targetDir);
    if (!dirExists) {
      logger.error('Spec directory not found, using default specs', undefined, {
        specDir: targetDir,
      });
      return { ...DEFAULT_SPECS };
    }

    // 各仕様ファイルを読み込む
    const specs: SpecContent = {
      role: '',
      guardrails: '',
      conversation: '',
      habits: '',
      responseFormat: '',
    };

    const specKeys = Object.keys(SPEC_FILE_MAPPING) as Array<keyof SpecContent>;

    for (const key of specKeys) {
      const fileName = SPEC_FILE_MAPPING[key];
      const filePath = path.join(targetDir, fileName);

      specs[key] = await this.loadSpecFile(filePath, key);
    }

    // キャッシュに保存
    this.cachedSpecs = specs;

    logger.info('Spec files loaded successfully', {
      specDir: targetDir,
      loadedFiles: specKeys.map(k => SPEC_FILE_MAPPING[k]),
    });

    return specs;
  }

  /**
   * 単一の仕様ファイルを読み込む
   *
   * @param filePath - ファイルパス
   * @param specKey - 仕様のキー
   * @returns ファイル内容またはデフォルト値
   */
  private async loadSpecFile(
    filePath: string,
    specKey: keyof SpecContent
  ): Promise<string> {
    let lastError: Error | null = null;

    // リトライ付きでファイルを読み込む
    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');

        // 空ファイルの場合はデフォルト値を使用
        if (!content.trim()) {
          logger.warning('Spec file is empty, using default', {
            filePath,
            specKey,
          });
          return DEFAULT_SPECS[specKey];
        }

        return content;
      } catch (error) {
        lastError = error as Error;

        if (attempt < RETRY_CONFIG.maxRetries) {
          logger.warning('Spec file read failed, retrying', {
            filePath,
            specKey,
            attempt: attempt + 1,
            maxRetries: RETRY_CONFIG.maxRetries,
            error: (error as Error).message,
          });
          await this.delay(RETRY_CONFIG.retryDelayMs);
        }
      }
    }

    // 全てのリトライが失敗した場合
    const errorCode = (lastError as NodeJS.ErrnoException)?.code;

    if (errorCode === 'ENOENT') {
      logger.warning('Spec file not found, using default', {
        filePath,
        specKey,
      });
    } else {
      logger.error('Failed to read spec file after retries, using default', lastError!, {
        filePath,
        specKey,
      });
    }

    return DEFAULT_SPECS[specKey];
  }

  /**
   * ディレクトリの存在を確認する
   *
   * @param dirPath - ディレクトリパス
   * @returns 存在する場合はtrue
   */
  private async checkDirectoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * 指定ミリ秒待機する
   *
   * @param ms - 待機時間（ミリ秒）
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 仕様をシステムプロンプトに変換する
   *
   * @param specs - 仕様内容
   * @returns システムプロンプト文字列
   */
  buildSystemPrompt(specs: SpecContent): string {
    const sections = [
      specs.role,
      specs.guardrails,
      specs.conversation,
      specs.habits,
      specs.responseFormat,
    ];

    // 各セクションを改行2つで結合
    const prompt = sections
      .filter(section => section.trim().length > 0)
      .join('\n\n');

    logger.debug('System prompt built', {
      promptLength: prompt.length,
      sectionCount: sections.filter(s => s.trim().length > 0).length,
    });

    return prompt;
  }

  /**
   * キャッシュされた仕様を取得する
   *
   * @returns キャッシュされた仕様、またはnull
   */
  getCachedSpecs(): SpecContent | null {
    return this.cachedSpecs;
  }

  /**
   * キャッシュをクリアする
   */
  clearCache(): void {
    this.cachedSpecs = null;
    logger.debug('Spec cache cleared');
  }

  /**
   * 仕様ファイルの変更を監視する（開発環境用）
   *
   * Note: この機能は開発環境でのホットリロード用です。
   * Node.js の fs.watch は非同期イテレータを返すため、
   * 本番環境では使用しないでください。
   *
   * @param specDir - 仕様ファイルのディレクトリパス
   * @param callback - 変更時に呼び出されるコールバック
   * @returns 監視を停止する関数
   */
  watchForChanges(
    specDir: string,
    callback: () => void
  ): (() => void) | undefined {
    // Lambda環境では監視を無効化
    if (process.env['AWS_LAMBDA_FUNCTION_NAME']) {
      logger.debug('File watching disabled in Lambda environment');
      return undefined;
    }

    // Node.js の fs.promises.watch は AsyncIterable を返すため、
    // 同期的な fs.watch を使用する
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fsSync = require('fs') as typeof import('fs');

    try {
      const watcher = fsSync.watch(
        specDir,
        { recursive: true },
        (eventType: string, filename: string | null) => {
          if (filename && filename.endsWith('.md')) {
            logger.info('Spec file changed', {
              eventType,
              filename,
            });
            this.clearCache();
            callback();
          }
        }
      );

      logger.info('Started watching spec files', { specDir });

      // 監視を停止する関数を返す
      return () => {
        watcher.close();
        logger.info('Stopped watching spec files', { specDir });
      };
    } catch (error) {
      logger.warning('Failed to start file watcher', {
        specDir,
        error: (error as Error).message,
      });
      return undefined;
    }
  }
}

// シングルトンインスタンス
let specLoaderInstance: SpecLoader | null = null;

/**
 * SpecLoaderのシングルトンインスタンスを取得する
 *
 * @param specDir - 仕様ファイルのディレクトリパス（オプション）
 * @returns SpecLoaderインスタンス
 */
export function getSpecLoader(specDir?: string): SpecLoader {
  if (!specLoaderInstance) {
    specLoaderInstance = new SpecLoader(specDir);
  }
  return specLoaderInstance;
}

/**
 * SpecLoaderインスタンスをリセットする（テスト用）
 */
export function resetSpecLoader(): void {
  specLoaderInstance = null;
}

/**
 * デフォルトの仕様内容を取得する（テスト用）
 */
export function getDefaultSpecs(): SpecContent {
  return { ...DEFAULT_SPECS };
}
