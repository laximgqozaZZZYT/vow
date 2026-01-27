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
      // Lambda環境では /var/task/lambda-package/specs/ai-coach になる
      return '/var/task/lambda-package/specs/ai-coach';
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

// ============================================================================
// THLI-24 Prompt Loader
// ============================================================================

/**
 * THLI-24プロンプトの必須セクション
 * Requirements: 11.3 - プロンプトテンプレートの検証
 */
export const THLI_REQUIRED_SECTIONS = [
  'Role',
  'Facts system',
  'PASS 1',
  'PASS 2',
  'External Cross-Check Lens',
  'Output format',
] as const;

/**
 * THLI-24プロンプトの必須セクション（日本語版）
 * Requirements: 15.1, 15.3 - 日本語ローカライズ版のセクション
 */
export const THLI_REQUIRED_SECTIONS_JA: Record<string, string[]> = {
  'Role': ['役割', 'Role'],
  'Facts system': ['Facts システム', 'Facts system', 'Factsシステム'],
  'PASS 1': ['PASS 1', 'パス1', '監査'],
  'PASS 2': ['PASS 2', 'パス2', 'スコアリング'],
  'External Cross-Check Lens': ['外部クロスチェックレンズ', 'External Cross-Check Lens', '外部レンズ'],
  'Output format': ['出力フォーマット', 'Output format', '出力形式'],
};

/**
 * THLI-24プロンプトのコンテキスト注入用プレースホルダー
 * Requirements: 11.7, 15.4, 15.5 - コンテキスト注入
 */
export const THLI_CONTEXT_PLACEHOLDERS = {
  HABIT_NAME: '{{HABIT_NAME}}',
  CURRENT_WORKLOAD: '{{CURRENT_WORKLOAD}}',
  GOAL_CONTEXT: '{{GOAL_CONTEXT}}',
  USER_LEVEL: '{{USER_LEVEL}}',
} as const;

/**
 * THLI-24プロンプトの検証結果
 */
export interface THLIPromptValidationResult {
  /** 検証が成功したかどうか */
  isValid: boolean;
  /** 見つかったセクション */
  foundSections: string[];
  /** 欠落しているセクション */
  missingSections: string[];
  /** プロンプトのバージョン */
  version: string | null;
  /** エラーメッセージ（検証失敗時） */
  errorMessage?: string;
}

/**
 * THLI-24プロンプトのコンテキスト
 * Requirements: 15.5 - コンテキスト値の注入
 */
export interface THLIPromptContext {
  /** 習慣名 */
  habitName: string;
  /** 現在のワークロード */
  currentWorkload: string;
  /** ゴールコンテキスト */
  goalContext: string;
  /** ユーザーレベル */
  userLevel: string;
}

/**
 * THLI-24プロンプトローダークラス
 *
 * THLI-24 v1.9プロンプトテンプレートを読み込み、検証し、
 * コンテキストを注入するサービス。
 *
 * Requirements:
 * - 11.1: THE System SHALL store the THLI-24 v1.9 prompt as a markdown file
 * - 11.2: WHEN the THLI_Assessment_Service initializes, THE System SHALL load the prompt template
 * - 11.3: WHEN the prompt template is loaded, THE System SHALL validate it contains all required sections
 * - 11.4: THE System SHALL support prompt versioning with semantic version numbers
 * - 11.6: THE SpecLoader SHALL cache loaded THLI-24 prompts in memory
 * - 15.1: THE System SHALL store a Japanese-localized version of the THLI-24 v1.9 prompt
 * - 15.2: WHEN building the assessment prompt, THE System SHALL detect the user's language preference
 */
export class THLIPromptLoader {
  private cachedPrompts: Map<string, string> = new Map();
  private specDir: string;

  /**
   * THLIPromptLoaderを初期化する
   *
   * @param specDir - 仕様ファイルのディレクトリパス（デフォルト: backend/specs/ai-coach）
   */
  constructor(specDir?: string) {
    this.specDir = specDir || this.getDefaultSpecDir();
  }

  /**
   * デフォルトの仕様ディレクトリパスを取得
   */
  private getDefaultSpecDir(): string {
    if (process.env['AWS_LAMBDA_FUNCTION_NAME']) {
      return '/var/task/lambda-package/specs/ai-coach';
    }
    return path.resolve(process.cwd(), 'specs/ai-coach');
  }

  /**
   * THLI-24プロンプトを読み込む
   *
   * @param language - 言語コード ('en' | 'ja')
   * @param version - プロンプトバージョン（デフォルト: 'v1.9'）
   * @returns プロンプト内容
   *
   * Requirements: 11.2, 15.2
   */
  async loadTHLIPrompt(
    language: 'en' | 'ja' = 'en',
    version: string = 'v1.9'
  ): Promise<string> {
    const cacheKey = `thli-24-${version}-${language}`;

    // キャッシュから取得
    const cached = this.cachedPrompts.get(cacheKey);
    if (cached) {
      logger.debug('THLI prompt loaded from cache', { cacheKey });
      return cached;
    }

    // ファイル名を構築
    const fileName = language === 'ja'
      ? `thli-24-${version}-prompt-ja.md`
      : `thli-24-${version}-prompt.md`;

    const filePath = path.join(this.specDir, fileName);

    logger.info('Loading THLI-24 prompt', { filePath, language, version });

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      if (!content.trim()) {
        throw new Error(`THLI prompt file is empty: ${filePath}`);
      }

      // キャッシュに保存
      this.cachedPrompts.set(cacheKey, content);

      logger.info('THLI-24 prompt loaded successfully', {
        filePath,
        language,
        version,
        contentLength: content.length,
      });

      return content;
    } catch (error) {
      const errorMessage = (error as Error).message;
      logger.error('Failed to load THLI-24 prompt', error as Error, {
        filePath,
        language,
        version,
      });

      // 英語版にフォールバック（日本語版が見つからない場合）
      if (language === 'ja') {
        logger.warning('Falling back to English THLI prompt');
        return this.loadTHLIPrompt('en', version);
      }

      throw new Error(`Failed to load THLI-24 prompt: ${errorMessage}`);
    }
  }

  /**
   * THLI-24プロンプトを検証する
   *
   * @param content - プロンプト内容
   * @returns 検証結果
   *
   * Requirements: 11.3, 15.1
   */
  validateTHLIPrompt(content: string): THLIPromptValidationResult {
    const foundSections: string[] = [];
    const missingSections: string[] = [];

    // 必須セクションの存在確認
    for (const section of THLI_REQUIRED_SECTIONS) {
      // 英語と日本語の両方のセクション名を取得
      const sectionVariants = THLI_REQUIRED_SECTIONS_JA[section] || [section];
      
      // 各バリアントに対してパターンを検索
      let found = false;
      for (const variant of sectionVariants) {
        // セクションヘッダーのパターンを検索
        // "## Role", "# A) Facts system", "# B) PASS 1", "## 役割" などのパターンに対応
        const escapedVariant = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const patterns = [
          new RegExp(`^#+\\s*${escapedVariant}`, 'im'),
          new RegExp(`^#+\\s*[A-Z]\\)\\s*${escapedVariant}`, 'im'),
          new RegExp(`^#+\\s*\\d+\\)\\s*${escapedVariant}`, 'im'),
        ];

        if (patterns.some(pattern => pattern.test(content))) {
          found = true;
          break;
        }
      }

      if (found) {
        foundSections.push(section);
      } else {
        missingSections.push(section);
      }
    }

    // バージョンの抽出
    const versionMatch = content.match(/THLI-24\s+v(\d+\.\d+)/i);
    const version = versionMatch ? `v${versionMatch[1]}` : null;

    const isValid = missingSections.length === 0;

    const result: THLIPromptValidationResult = {
      isValid,
      foundSections,
      missingSections,
      version,
    };

    if (!isValid) {
      result.errorMessage = `Missing required sections: ${missingSections.join(', ')}`;
      logger.warning('THLI prompt validation failed', {
        missingSections,
        foundSections,
        version,
      });
    } else {
      logger.debug('THLI prompt validation passed', {
        foundSections,
        version,
      });
    }

    return result;
  }

  /**
   * THLI-24プロンプトにコンテキストを注入する
   *
   * @param prompt - プロンプトテンプレート
   * @param context - 注入するコンテキスト
   * @returns コンテキストが注入されたプロンプト
   *
   * Requirements: 11.7, 15.5
   */
  injectContext(prompt: string, context: THLIPromptContext): string {
    let result = prompt;

    // プレースホルダーを実際の値に置換
    result = result.replace(
      new RegExp(THLI_CONTEXT_PLACEHOLDERS.HABIT_NAME, 'g'),
      context.habitName
    );
    result = result.replace(
      new RegExp(THLI_CONTEXT_PLACEHOLDERS.CURRENT_WORKLOAD, 'g'),
      context.currentWorkload
    );
    result = result.replace(
      new RegExp(THLI_CONTEXT_PLACEHOLDERS.GOAL_CONTEXT, 'g'),
      context.goalContext
    );
    result = result.replace(
      new RegExp(THLI_CONTEXT_PLACEHOLDERS.USER_LEVEL, 'g'),
      context.userLevel
    );

    logger.debug('Context injected into THLI prompt', {
      habitName: context.habitName,
      hasWorkload: !!context.currentWorkload,
      hasGoalContext: !!context.goalContext,
      hasUserLevel: !!context.userLevel,
    });

    return result;
  }

  /**
   * THLI-24プロンプトを読み込み、検証し、コンテキストを注入する
   *
   * @param language - 言語コード ('en' | 'ja')
   * @param context - 注入するコンテキスト
   * @param version - プロンプトバージョン（デフォルト: 'v1.9'）
   * @returns 準備されたプロンプト
   *
   * Requirements: 11.2, 11.3, 11.7, 15.2, 15.5
   */
  async prepareTHLIPrompt(
    language: 'en' | 'ja',
    context: THLIPromptContext,
    version: string = 'v1.9'
  ): Promise<{ prompt: string; validation: THLIPromptValidationResult }> {
    // プロンプトを読み込む
    const rawPrompt = await this.loadTHLIPrompt(language, version);

    // 検証
    const validation = this.validateTHLIPrompt(rawPrompt);

    if (!validation.isValid) {
      logger.warning('Using THLI prompt despite validation failure', {
        missingSections: validation.missingSections,
      });
    }

    // コンテキストを注入
    const prompt = this.injectContext(rawPrompt, context);

    return { prompt, validation };
  }

  /**
   * キャッシュされたプロンプトを取得する
   *
   * @param language - 言語コード
   * @param version - バージョン
   * @returns キャッシュされたプロンプト、またはnull
   */
  getCachedPrompt(language: 'en' | 'ja', version: string = 'v1.9'): string | null {
    const cacheKey = `thli-24-${version}-${language}`;
    return this.cachedPrompts.get(cacheKey) || null;
  }

  /**
   * キャッシュをクリアする
   *
   * Requirements: 11.6 - ホットリロードサポート
   */
  clearCache(): void {
    this.cachedPrompts.clear();
    logger.debug('THLI prompt cache cleared');
  }

  /**
   * 特定のプロンプトのキャッシュをクリアする
   *
   * @param language - 言語コード
   * @param version - バージョン
   */
  clearCacheForPrompt(language: 'en' | 'ja', version: string = 'v1.9'): void {
    const cacheKey = `thli-24-${version}-${language}`;
    this.cachedPrompts.delete(cacheKey);
    logger.debug('THLI prompt cache cleared for specific prompt', { cacheKey });
  }

  /**
   * プロンプトからバージョンを抽出する
   *
   * @param content - プロンプト内容
   * @returns バージョン文字列（例: "v1.9"）、見つからない場合はnull
   *
   * Requirements: 11.5
   */
  extractVersion(content: string): string | null {
    const versionMatch = content.match(/THLI-24\s+v(\d+\.\d+)/i);
    return versionMatch ? `v${versionMatch[1]}` : null;
  }
}

// THLIPromptLoaderのシングルトンインスタンス
let thliPromptLoaderInstance: THLIPromptLoader | null = null;

/**
 * THLIPromptLoaderのシングルトンインスタンスを取得する
 *
 * @param specDir - 仕様ファイルのディレクトリパス（オプション）
 * @returns THLIPromptLoaderインスタンス
 */
export function getTHLIPromptLoader(specDir?: string): THLIPromptLoader {
  if (!thliPromptLoaderInstance) {
    thliPromptLoaderInstance = new THLIPromptLoader(specDir);
  }
  return thliPromptLoaderInstance;
}

/**
 * THLIPromptLoaderインスタンスをリセットする（テスト用）
 */
export function resetTHLIPromptLoader(): void {
  thliPromptLoaderInstance = null;
}
