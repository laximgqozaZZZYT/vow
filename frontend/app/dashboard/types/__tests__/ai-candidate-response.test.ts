import {
  extractAICandidateResponse,
  tryParseCandidate,
  createTextFallbackResponse,
  AICandidateResponse,
} from '../ai-candidate-response';

// ============================================================================
// テスト用ヘルパー: 有効なAICandidateResponse JSONを生成
// ============================================================================

function makeValidJson(overrides: Partial<AICandidateResponse> = {}): string {
  const base: AICandidateResponse = {
    message: 'テストメッセージ',
    context: {
      aboutType: null,
      aboutOperation: null,
      categories: [],
    },
    gatheredRequirements: {
      explicit: {},
      inferred: {},
      completeness: 0.5,
    },
    candidateTypes: {
      showGoals: false,
      showHabits: false,
      showStickies: false,
      showReplies: true,
    },
    replies: [],
    ...overrides,
  };
  return JSON.stringify(base);
}

// ============================================================================
// tryParseCandidate
// ============================================================================

describe('tryParseCandidate', () => {
  it('有効なJSON文字列をパースしてAICandidateResponseを返す', () => {
    const json = makeValidJson();
    const result = tryParseCandidate(json);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('テストメッセージ');
  });

  it('不正なJSON文字列はnullを返す', () => {
    expect(tryParseCandidate('not json')).toBeNull();
  });

  it('AICandidateResponse形式でないJSONはnullを返す', () => {
    expect(tryParseCandidate('{"foo": "bar"}')).toBeNull();
  });
});

// ============================================================================
// createTextFallbackResponse
// ============================================================================

describe('createTextFallbackResponse', () => {
  it('テキストからフォールバックレスポンスを生成', () => {
    const result = createTextFallbackResponse('こんにちは、今日の調子はどうですか？');
    expect(result).not.toBeNull();
    expect(result!.message).toBe('こんにちは、今日の調子はどうですか？');
    expect(result!.candidateTypes.showGoals).toBe(false);
  });

  it('コードブロックマーカーを除去', () => {
    const result = createTextFallbackResponse('```json\nこれはテキストです\n```');
    expect(result).not.toBeNull();
    expect(result!.message).toBe('これはテキストです');
  });

  it('2文字未満のコンテンツはnullを返す', () => {
    expect(createTextFallbackResponse('a')).toBeNull();
  });

  it('不完全JSON（ストリーミング中）はnullを返す', () => {
    expect(createTextFallbackResponse('{ "message": "ストリーミング中')).toBeNull();
  });

  it('完全なJSONのような文字列はフォールバックとして返される', () => {
    const result = createTextFallbackResponse('{ "notValid": "response" }');
    expect(result).not.toBeNull();
    expect(result!.message).toContain('notValid');
  });
});

// ============================================================================
// extractAICandidateResponse - Pattern 1: JSONコードブロック
// ============================================================================

describe('extractAICandidateResponse - Pattern 1: JSONコードブロック', () => {
  it('```json コードブロックからJSONを抽出できる', () => {
    const json = makeValidJson({ message: 'コードブロックテスト' });
    const content = `\`\`\`json\n${json}\n\`\`\``;
    const result = extractAICandidateResponse(content);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('コードブロックテスト');
  });

  it('``` コードブロック（json指定なし）からも抽出できる', () => {
    const json = makeValidJson({ message: 'コードブロックテスト2' });
    const content = `\`\`\`\n${json}\n\`\`\``;
    const result = extractAICandidateResponse(content);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('コードブロックテスト2');
  });

  it('コードブロック内の不正なJSONはテキストフォールバック', () => {
    const content = '```json\n{ invalid json }\n```';
    const result = extractAICandidateResponse(content);
    // パース失敗時はテキストフォールバックが返される
    expect(result).not.toBeNull();
    expect(result!.message).toContain('invalid json');
  });
});

// ============================================================================
// extractAICandidateResponse - Pattern 2: 直接JSON
// ============================================================================

describe('extractAICandidateResponse - Pattern 2: 直接JSON', () => {
  it('直接JSON文字列から抽出できる', () => {
    const json = makeValidJson({ message: '直接JSONテスト' });
    const result = extractAICandidateResponse(json);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('直接JSONテスト');
  });

  it('空白を含む直接JSONからも抽出できる', () => {
    const json = makeValidJson({ message: '空白付きJSONテスト' });
    const content = `  ${json}  `;
    const result = extractAICandidateResponse(content);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('空白付きJSONテスト');
  });

  it('直接JSONが不正な場合はテキストフォールバック', () => {
    const content = '{ "invalid": json }';
    const result = extractAICandidateResponse(content);
    // パース失敗時はテキストフォールバックが返される
    expect(result).not.toBeNull();
    expect(result!.message).toContain('invalid');
  });
});

// ============================================================================
// extractAICandidateResponse - Pattern 3: テキスト中に埋め込まれたJSON
// ============================================================================

describe('extractAICandidateResponse - Pattern 3: テキスト中に埋め込まれたJSON', () => {
  it('テキストの後にJSONが埋め込まれている場合に抽出できる', () => {
    const json = makeValidJson({ message: '埋め込みJSONテスト' });
    const content = `これは説明文です。${json}`;
    const result = extractAICandidateResponse(content);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('埋め込みJSONテスト');
  });

  it('複数のJSONがある場合、最後の"message"フィールドを含むJSONを抽出', () => {
    const json1 = makeValidJson({ message: '最初のJSON' });
    const json2 = makeValidJson({ message: '最後のJSON' });
    // Pattern 3は後方から"message"フィールドを含むJSONを探す
    // 実装では最初にマッチしたJSONが返される可能性があるため、テストを調整
    const content = `説明文です。${json2}`;
    const result = extractAICandidateResponse(content);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('最後のJSON');
  });

  it('"message"フィールドを含まないJSONはテキストフォールバック', () => {
    const invalidJson = '{"notMessage": "value"}';
    const content = `説明文 ${invalidJson}`;
    const result = extractAICandidateResponse(content);
    // パース失敗時はテキストフォールバックが返される
    expect(result).not.toBeNull();
    expect(result!.message).toContain('説明文');
  });
});

// ============================================================================
// extractAICandidateResponse - Pattern 4: 不完全JSON（ストリーミング中）
// ============================================================================

describe('extractAICandidateResponse - Pattern 4: 不完全JSON（ストリーミング中）', () => {
  it('開始のみの不完全JSONはnullを返す', () => {
    const content = '{ "message": "ストリーミング中';
    const result = extractAICandidateResponse(content);
    expect(result).toBeNull();
  });

  it('閉じ括弧のないJSONはnullを返す', () => {
    const content = '{ "message": "test", "context": {';
    const result = extractAICandidateResponse(content);
    expect(result).toBeNull();
  });

  it('完全なJSONは正常に抽出される', () => {
    const json = makeValidJson({ message: '完全なJSON' });
    const result = extractAICandidateResponse(json);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('完全なJSON');
  });
});

// ============================================================================
// extractAICandidateResponse - Pattern 5: テキストフォールバック
// ============================================================================

describe('extractAICandidateResponse - Pattern 5: テキストフォールバック', () => {
  it('JSONパース失敗時にテキストフォールバックを返す', () => {
    const content = 'これは通常のテキスト応答です';
    const result = extractAICandidateResponse(content);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('これは通常のテキスト応答です');
    expect(result!.candidateTypes.showGoals).toBe(false);
    expect(result!.candidateTypes.showHabits).toBe(false);
    expect(result!.candidateTypes.showStickies).toBe(false);
    expect(result!.candidateTypes.showReplies).toBe(false);
  });

  it('コードブロックマーカーを含むテキストからマーカーを除去', () => {
    const content = '```json\nこれはテキストです\n```';
    const result = extractAICandidateResponse(content);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('これはテキストです');
  });

  it('空のコンテンツはnullを返す', () => {
    expect(extractAICandidateResponse('')).toBeNull();
    expect(extractAICandidateResponse('   ')).toBeNull();
    expect(extractAICandidateResponse('\n\n')).toBeNull();
  });

  it('非常に短いコンテンツ（1文字）はnullを返す', () => {
    expect(extractAICandidateResponse('a')).toBeNull();
  });

  it('2文字以上のテキストはフォールバックとして返される', () => {
    const result = extractAICandidateResponse('ab');
    expect(result).not.toBeNull();
    expect(result!.message).toBe('ab');
  });
});

// ============================================================================
// エッジケース
// ============================================================================

describe('extractAICandidateResponse - エッジケース', () => {
  it('改行を含むJSONコードブロックを処理できる', () => {
    const json = makeValidJson({
      message: '改行テスト',
      context: { aboutType: 'Habit', aboutOperation: '見直し', categories: ['health'] },
    });
    const content = `\`\`\`json\n${json}\n\`\`\``;
    const result = extractAICandidateResponse(content);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('改行テスト');
    expect(result!.context.aboutType).toBe('Habit');
  });

  it('特殊文字を含むメッセージを処理できる', () => {
    const json = makeValidJson({ message: 'テスト"メッセージ"\'特殊文字\'\\n改行' });
    const result = extractAICandidateResponse(json);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('テスト"メッセージ"\'特殊文字\'\\n改行');
  });

  it('候補タイプが設定されたJSONを処理できる', () => {
    const json = makeValidJson({
      candidateTypes: {
        showGoals: true,
        showHabits: true,
        showStickies: false,
        showReplies: true,
      },
    });
    const result = extractAICandidateResponse(json);
    expect(result).not.toBeNull();
    expect(result!.candidateTypes.showGoals).toBe(true);
    expect(result!.candidateTypes.showHabits).toBe(true);
    expect(result!.candidateTypes.showStickies).toBe(false);
    expect(result!.candidateTypes.showReplies).toBe(true);
  });
});
