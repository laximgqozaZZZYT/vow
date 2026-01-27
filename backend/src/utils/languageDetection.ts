/**
 * Language Detection Utility
 *
 * ユーザーの言語設定を検出するユーティリティ。
 *
 * Requirements:
 * - 15.2: WHEN building the assessment prompt, THE System SHALL detect the user's
 *         language preference from their profile or browser settings and load the
 *         appropriate prompt file (ja or en)
 */

import { getLogger } from './logger.js';

const logger = getLogger('languageDetection');

/**
 * サポートされている言語
 */
export type SupportedLanguage = 'en' | 'ja';

/**
 * デフォルト言語（日本語）
 */
export const DEFAULT_LANGUAGE: SupportedLanguage = 'ja';

/**
 * サポートされている言語のリスト
 */
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['en', 'ja'];

/**
 * 言語コードがサポートされているかチェック
 *
 * @param lang - 言語コード
 * @returns サポートされている場合はtrue
 */
export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
}

/**
 * リクエストヘッダーから言語を検出する
 *
 * 優先順位:
 * 1. x-language ヘッダー（フロントエンドから明示的に指定）
 * 2. Accept-Language ヘッダー（ブラウザ設定）
 * 3. デフォルト言語（日本語）
 *
 * @param headers - リクエストヘッダー
 * @returns 検出された言語
 */
export function detectLanguageFromHeaders(
  headers: Record<string, string | string[] | undefined>
): SupportedLanguage {
  // 1. x-language ヘッダーをチェック
  const xLanguage = headers['x-language'];
  if (xLanguage) {
    const lang = Array.isArray(xLanguage) ? xLanguage[0] : xLanguage;
    if (lang && isSupportedLanguage(lang.toLowerCase())) {
      logger.debug('Language detected from x-language header', { language: lang });
      return lang.toLowerCase() as SupportedLanguage;
    }
  }

  // 2. Accept-Language ヘッダーをチェック
  const acceptLanguage = headers['accept-language'];
  if (acceptLanguage) {
    const langHeader = Array.isArray(acceptLanguage) ? acceptLanguage[0] : acceptLanguage;
    if (langHeader) {
      const detectedLang = parseAcceptLanguage(langHeader);
      if (detectedLang) {
        logger.debug('Language detected from Accept-Language header', {
          language: detectedLang,
          header: langHeader,
        });
        return detectedLang;
      }
    }
  }

  // 3. デフォルト言語を返す
  logger.debug('Using default language', { language: DEFAULT_LANGUAGE });
  return DEFAULT_LANGUAGE;
}

/**
 * Accept-Language ヘッダーをパースして最適な言語を返す
 *
 * Accept-Language の形式: "ja,en-US;q=0.9,en;q=0.8"
 *
 * @param header - Accept-Language ヘッダー値
 * @returns サポートされている言語、またはnull
 */
export function parseAcceptLanguage(header: string): SupportedLanguage | null {
  // 言語タグを品質値でソート
  const languages = header
    .split(',')
    .map((part) => {
      const [lang, qValue] = part.trim().split(';q=');
      const quality = qValue ? parseFloat(qValue) : 1.0;
      // 言語コードの最初の部分のみを使用（例: "en-US" -> "en"）
      const langCode = lang.split('-')[0].toLowerCase();
      return { lang: langCode, quality };
    })
    .sort((a, b) => b.quality - a.quality);

  // サポートされている言語を探す
  for (const { lang } of languages) {
    if (isSupportedLanguage(lang)) {
      return lang;
    }
  }

  return null;
}

/**
 * ユーザー設定から言語を取得する
 *
 * 将来的にユーザープロファイルに言語設定が追加された場合に使用
 *
 * @param userSettings - ユーザー設定オブジェクト
 * @returns 言語設定、またはnull
 */
export function getLanguageFromUserSettings(
  userSettings: { language?: string } | null | undefined
): SupportedLanguage | null {
  if (!userSettings?.language) {
    return null;
  }

  const lang = userSettings.language.toLowerCase();
  if (isSupportedLanguage(lang)) {
    return lang;
  }

  return null;
}

/**
 * 言語を検出する（複数のソースから）
 *
 * 優先順位:
 * 1. ユーザー設定（将来的に実装）
 * 2. リクエストヘッダー
 * 3. デフォルト言語
 *
 * @param options - 検出オプション
 * @returns 検出された言語
 */
export function detectLanguage(options: {
  userSettings?: { language?: string } | null;
  headers?: Record<string, string | string[] | undefined>;
  defaultLanguage?: SupportedLanguage;
}): SupportedLanguage {
  const { userSettings, headers, defaultLanguage = DEFAULT_LANGUAGE } = options;

  // 1. ユーザー設定から取得
  const userLang = getLanguageFromUserSettings(userSettings);
  if (userLang) {
    logger.debug('Language detected from user settings', { language: userLang });
    return userLang;
  }

  // 2. ヘッダーから取得
  if (headers) {
    return detectLanguageFromHeaders(headers);
  }

  // 3. デフォルト言語を返す
  return defaultLanguage;
}
