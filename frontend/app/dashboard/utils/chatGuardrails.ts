/**
 * Chat Guardrails - Content Moderation System
 *
 * Provides input validation and output filtering for chat interactions
 * with MCP servers, OpenAI, and other AI providers.
 *
 * @module utils/chatGuardrails
 */

/**
 * Guardrail check result
 */
export interface GuardrailResult {
  allowed: boolean;
  reason?: string;
  category?: ViolationCategory;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Violation categories
 */
export type ViolationCategory =
  | 'illegal_activity'
  | 'violence'
  | 'harassment'
  | 'hate_speech'
  | 'sexual_content'
  | 'self_harm'
  | 'personal_info'
  | 'malware'
  | 'fraud'
  | 'spam'
  | 'jailbreak';

/**
 * Prohibited patterns with categories and severity
 */
interface ProhibitedPattern {
  pattern: RegExp;
  category: ViolationCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

/**
 * Prohibited content patterns
 * These patterns detect potentially harmful content in user input
 */
const PROHIBITED_PATTERNS: ProhibitedPattern[] = [
  // Illegal activities
  {
    pattern: /(?:how\s+to\s+)?(?:make|create|build|synthesize)\s+(?:a\s+)?(?:bomb|explosive|weapon|drug|meth|cocaine)/i,
    category: 'illegal_activity',
    severity: 'critical',
    description: 'Request for illegal substance/weapon creation',
  },
  {
    pattern: /(?:hack|crack|breach|exploit)\s+(?:into|a|the)?\s*(?:bank|account|system|server|database|password)/i,
    category: 'illegal_activity',
    severity: 'critical',
    description: 'Hacking/unauthorized access request',
  },
  {
    pattern: /(?:steal|theft|rob|burglary|break\s*into)/i,
    category: 'illegal_activity',
    severity: 'high',
    description: 'Theft-related request',
  },
  {
    pattern: /(?:money\s+laundering|launder\s+money|tax\s+evasion|evade\s+taxes)/i,
    category: 'fraud',
    severity: 'critical',
    description: 'Financial crime request',
  },

  // Violence
  {
    pattern: /(?:kill|murder|assassinate|harm|hurt|attack)\s+(?:someone|a\s+person|people|my|the)/i,
    category: 'violence',
    severity: 'critical',
    description: 'Violence against persons',
  },
  {
    pattern: /(?:torture|mutilate|dismember)/i,
    category: 'violence',
    severity: 'critical',
    description: 'Extreme violence',
  },

  // Harassment
  {
    pattern: /(?:stalk|harass|bully|threaten|intimidate)\s+(?:someone|a\s+person|my|the)/i,
    category: 'harassment',
    severity: 'high',
    description: 'Harassment request',
  },
  {
    pattern: /(?:doxx|doxing|expose\s+personal\s+info)/i,
    category: 'harassment',
    severity: 'critical',
    description: 'Doxxing request',
  },

  // Self-harm
  {
    pattern: /(?:how\s+to\s+)?(?:commit\s+)?suicide|kill\s+myself|end\s+my\s+life/i,
    category: 'self_harm',
    severity: 'critical',
    description: 'Self-harm content',
  },
  {
    pattern: /(?:cut|harm)\s+myself|self[- ]?harm/i,
    category: 'self_harm',
    severity: 'critical',
    description: 'Self-harm content',
  },

  // Malware
  {
    pattern: /(?:create|write|generate|code)\s+(?:a\s+)?(?:virus|malware|ransomware|trojan|keylogger|spyware)/i,
    category: 'malware',
    severity: 'critical',
    description: 'Malware creation request',
  },
  {
    pattern: /(?:phishing|social\s+engineering)\s+(?:attack|email|page|site)/i,
    category: 'fraud',
    severity: 'high',
    description: 'Phishing attack request',
  },

  // Fraud
  {
    pattern: /(?:create|generate|make)\s+(?:a\s+)?(?:fake|forged|counterfeit)\s+(?:id|passport|document|certificate|diploma)/i,
    category: 'fraud',
    severity: 'critical',
    description: 'Document forgery request',
  },
  {
    pattern: /(?:scam|defraud|con|trick)\s+(?:someone|people|users|customers)/i,
    category: 'fraud',
    severity: 'high',
    description: 'Scam/fraud request',
  },

  // Jailbreak attempts
  {
    pattern: /(?:ignore|bypass|override|forget)\s+(?:your|all|previous|system)\s+(?:instructions|rules|guidelines|prompt)/i,
    category: 'jailbreak',
    severity: 'medium',
    description: 'Jailbreak attempt',
  },
  {
    pattern: /(?:pretend|act\s+as\s+if|imagine)\s+(?:you\s+have\s+no|there\s+are\s+no)\s+(?:rules|restrictions|limits)/i,
    category: 'jailbreak',
    severity: 'medium',
    description: 'Jailbreak attempt',
  },
  {
    pattern: /DAN\s*mode|do\s+anything\s+now|evil\s*mode/i,
    category: 'jailbreak',
    severity: 'high',
    description: 'Known jailbreak pattern',
  },

  // Personal information extraction
  {
    pattern: /(?:give|tell|show)\s+me\s+(?:someone's|a\s+person's)\s+(?:address|phone|ssn|social\s+security|credit\s+card)/i,
    category: 'personal_info',
    severity: 'high',
    description: 'PII extraction attempt',
  },
];

/**
 * Japanese prohibited patterns
 */
const PROHIBITED_PATTERNS_JA: ProhibitedPattern[] = [
  // Illegal activities
  {
    pattern: /(?:爆弾|爆発物|武器|銃|麻薬|覚せい剤|覚醒剤)(?:の)?(?:作り方|製造|合成)/,
    category: 'illegal_activity',
    severity: 'critical',
    description: '違法物作成の依頼',
  },
  {
    pattern: /(?:ハッキング|不正アクセス|侵入)(?:の)?(?:方法|やり方|仕方)/,
    category: 'illegal_activity',
    severity: 'critical',
    description: 'ハッキング依頼',
  },

  // Violence
  {
    pattern: /(?:殺す|殺害|暗殺|襲撃)(?:方法|やり方|仕方)/,
    category: 'violence',
    severity: 'critical',
    description: '暴力行為の依頼',
  },

  // Self-harm
  {
    pattern: /(?:自殺|自傷|死にたい|死ぬ方法)/,
    category: 'self_harm',
    severity: 'critical',
    description: '自傷行為関連',
  },

  // Fraud
  {
    pattern: /(?:偽造|偽物|詐欺)(?:の)?(?:作り方|方法|やり方)/,
    category: 'fraud',
    severity: 'high',
    description: '詐欺・偽造依頼',
  },

  // Malware
  {
    pattern: /(?:ウイルス|マルウェア|ランサムウェア)(?:の)?(?:作り方|作成|開発)/,
    category: 'malware',
    severity: 'critical',
    description: 'マルウェア作成依頼',
  },
];

/**
 * All prohibited patterns combined
 */
const ALL_PROHIBITED_PATTERNS = [...PROHIBITED_PATTERNS, ...PROHIBITED_PATTERNS_JA];

/**
 * Check if input contains prohibited content
 */
export function validateUserInput(input: string): GuardrailResult {
  if (!input || typeof input !== 'string') {
    return { allowed: true };
  }

  const normalizedInput = input.toLowerCase().trim();

  // Check against all prohibited patterns
  for (const { pattern, category, severity, description } of ALL_PROHIBITED_PATTERNS) {
    if (pattern.test(normalizedInput) || pattern.test(input)) {
      return {
        allowed: false,
        reason: description,
        category,
        severity,
      };
    }
  }

  // Check for excessive length (potential prompt injection)
  if (input.length > 10000) {
    return {
      allowed: false,
      reason: 'Message too long',
      category: 'spam',
      severity: 'low',
    };
  }

  return { allowed: true };
}

/**
 * Check if AI response contains prohibited content
 * This is a lighter check as we trust AI providers to some extent
 */
export function validateAIResponse(response: string): GuardrailResult {
  if (!response || typeof response !== 'string') {
    return { allowed: true };
  }

  // Check for obvious harmful content in responses
  const harmfulResponsePatterns: ProhibitedPattern[] = [
    {
      pattern: /here(?:'s| is) (?:how|a way) to (?:make|create|build) (?:a )?(?:bomb|explosive|weapon)/i,
      category: 'illegal_activity',
      severity: 'critical',
      description: 'Harmful instructions in response',
    },
    {
      pattern: /(?:step[- ]by[- ]step|instructions?) (?:for|to) (?:hack|crack|breach)/i,
      category: 'illegal_activity',
      severity: 'critical',
      description: 'Hacking instructions in response',
    },
    {
      pattern: /(?:here(?:'s| is) (?:the |a )?(?:code|script) for|malware|ransomware) (?:that|which) (?:will|can)/i,
      category: 'malware',
      severity: 'critical',
      description: 'Malware code in response',
    },
  ];

  for (const { pattern, category, severity, description } of harmfulResponsePatterns) {
    if (pattern.test(response)) {
      return {
        allowed: false,
        reason: description,
        category,
        severity,
      };
    }
  }

  return { allowed: true };
}

/**
 * Sanitize user input (remove potentially dangerous content while preserving message)
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove null bytes and control characters (except newlines and tabs)
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Trim excessive whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  // Limit length
  if (sanitized.length > 10000) {
    sanitized = sanitized.substring(0, 10000) + '...';
  }

  return sanitized;
}

/**
 * Get user-friendly error message for violation
 */
export function getViolationMessage(result: GuardrailResult, locale: 'en' | 'ja' = 'en'): string {
  if (result.allowed) {
    return '';
  }

  const messages: Record<ViolationCategory, { en: string; ja: string }> = {
    illegal_activity: {
      en: 'This request involves potentially illegal activity and cannot be processed.',
      ja: 'このリクエストは違法行為に関連する可能性があるため、処理できません。',
    },
    violence: {
      en: 'This request involves violent content and cannot be processed.',
      ja: 'このリクエストは暴力的な内容を含むため、処理できません。',
    },
    harassment: {
      en: 'This request involves harassment and cannot be processed.',
      ja: 'このリクエストはハラスメントに関連するため、処理できません。',
    },
    hate_speech: {
      en: 'This request involves hate speech and cannot be processed.',
      ja: 'このリクエストはヘイトスピーチを含むため、処理できません。',
    },
    sexual_content: {
      en: 'This request involves inappropriate content and cannot be processed.',
      ja: 'このリクエストは不適切な内容を含むため、処理できません。',
    },
    self_harm: {
      en: 'If you are struggling, please reach out to a mental health professional or crisis hotline.',
      ja: 'お困りの場合は、メンタルヘルスの専門家や相談窓口にご連絡ください。いのちの電話: 0570-783-556',
    },
    personal_info: {
      en: 'Requests for personal information cannot be processed.',
      ja: '個人情報に関するリクエストは処理できません。',
    },
    malware: {
      en: 'Requests related to malicious software cannot be processed.',
      ja: '悪意のあるソフトウェアに関するリクエストは処理できません。',
    },
    fraud: {
      en: 'Requests related to fraud or deception cannot be processed.',
      ja: '詐欺や欺瞞に関するリクエストは処理できません。',
    },
    spam: {
      en: 'This message appears to be spam or too long.',
      ja: 'このメッセージはスパムまたは長すぎます。',
    },
    jailbreak: {
      en: 'This type of request is not supported.',
      ja: 'このタイプのリクエストはサポートされていません。',
    },
  };

  const category = result.category || 'illegal_activity';
  return messages[category]?.[locale] || messages.illegal_activity[locale];
}

/**
 * Log violation for monitoring (without storing sensitive content)
 */
export function logViolation(
  result: GuardrailResult,
  context: {
    userId?: string;
    sessionId?: string;
    agentType?: string;
  }
): void {
  if (!result.allowed) {
    console.warn('[Guardrail] Violation detected:', {
      category: result.category,
      severity: result.severity,
      reason: result.reason,
      context: {
        ...context,
        timestamp: new Date().toISOString(),
      },
    });

    // In production, you might want to send this to a monitoring service
    // but never log the actual content that triggered the violation
  }
}

/**
 * Create a guardrail wrapper for chat functions
 */
export function createGuardedSendMessage(
  originalSendMessage: (message: string) => Promise<void>,
  options: {
    locale?: 'en' | 'ja';
    userId?: string;
    sessionId?: string;
    agentType?: string;
    onViolation?: (result: GuardrailResult, message: string) => void;
  } = {}
): (message: string) => Promise<void> {
  const { locale = 'en', userId, sessionId, agentType, onViolation } = options;

  return async (message: string) => {
    // Sanitize input
    const sanitizedMessage = sanitizeInput(message);

    // Validate input
    const validationResult = validateUserInput(sanitizedMessage);

    if (!validationResult.allowed) {
      // Log violation
      logViolation(validationResult, { userId, sessionId, agentType });

      // Notify via callback
      if (onViolation) {
        onViolation(validationResult, getViolationMessage(validationResult, locale));
      }

      // Throw error to prevent sending
      throw new Error(getViolationMessage(validationResult, locale));
    }

    // If allowed, proceed with original function
    return originalSendMessage(sanitizedMessage);
  };
}

export default {
  validateUserInput,
  validateAIResponse,
  sanitizeInput,
  getViolationMessage,
  logViolation,
  createGuardedSendMessage,
};
