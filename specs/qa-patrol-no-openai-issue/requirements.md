# QA Patrol Issue Creation Refactoring - OpenAI API Removal

## Overview
- Purpose: Remove OpenAI API dependency from QA Patrol Issue creation, replacing with template-based generation
- Status: Implemented
- Version: 1.0.0
- Last Updated: 2026-02-04
- Author: vow-spec-architect

## Background

The QA Patrol Agent (qa-patrol.spec.ts) creates Issue reports for test results. Previously, there was a concern that Issue text generation might use OpenAI API. After analysis, it was confirmed that the existing implementation already used inline template strings, but the code was not structured clearly.

This refactoring:
1. Confirms NO OpenAI API is used for Issue generation
2. Creates a clear, documented template system
3. Makes the code more maintainable and extensible

## Requirements

### Functional Requirements

- [FR-001] Issue generation MUST NOT call any external AI APIs (OpenAI, Anthropic, etc.)
- [FR-002] Issue content MUST be generated using pure template string interpolation
- [FR-003] Both PASSED and FAILED test results MUST generate appropriate Issue reports
- [FR-004] Issue reports MUST include all relevant test data (persona, scenario, conversation log, etc.)
- [FR-005] Simple Question Tests MUST use the same template-based approach

### Non-Functional Requirements

- [NFR-001] Issue generation MUST be synchronous and instant (no API latency)
- [NFR-002] Issue generation MUST be cost-free (no API calls = no billing)
- [NFR-003] Output format MUST be consistent and predictable
- [NFR-004] Code MUST be well-documented with clear comments about no API usage

## Implementation Details

### New Interfaces Added

```typescript
interface IssueConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface TestResultData {
  personaId: string;
  personaName: string;
  personaDescription: string;
  scenarioId: string;
  testStartTime: string;
  passed: boolean;
  qualityScore: number;
  initialMessage: string;
  isAmbiguous: boolean;
  expectedResponseType: string;
  expectedResponseContent: string;
  requiredClarifications?: string[];
  desiredOutcome?: {...};
  conversationLog: IssueConversationMessage[];
  exchangeCount: number;
  expectedBehaviorsDesc: string[];
  validationFailures: string[];
  hasError: boolean;
}

interface IssueTemplate {
  passedTitle: (personaName: string, scenarioId: string) => string;
  failedTitle: (personaName: string, scenarioId: string) => string;
  passedDescription: (data: TestResultData) => string;
  failedDescription: (data: TestResultData) => string;
}

interface SimpleQuestionResultData {
  questionId: string;
  question: string;
  desiredPurpose: string;
  desiredResponseType: string;
  detectedResponseType: string | null;
  expectedGenre: string;
  successKeywords: string[];
  matchedKeywords: string[];
  missingKeywords: string[];
  conversationLog: IssueConversationMessage[];
  exchangeCount: number;
  maxExchanges: number;
  passed: boolean;
  qualityScore: number;
  failureReason: string | null;
  finalResponse: string | null;
}
```

### New Functions Added

```typescript
// ISSUE_TEMPLATES constant with passedTitle, failedTitle, passedDescription, failedDescription

function generateIssueReport(
  data: TestResultData,
  validation: { passed: boolean; failures: string[] },
  errorStatus: { hasError: boolean }
): IssueReport

function generateSimpleQuestionIssueReport(data: SimpleQuestionResultData): IssueReport
```

## Files Modified

| File | Changes |
|------|---------|
| `/home/ubuntu/Downloads/vow/frontend/e2e/qa-patrol.spec.ts` | Added template system, refactored Issue generation |

## Acceptance Criteria

- [AC-001] TypeScript compilation succeeds without errors - PASSED
- [AC-002] Playwright test listing succeeds - PASSED
- [AC-003] No OpenAI import or API calls in Issue generation code - PASSED
- [AC-004] Issue generation uses ISSUE_TEMPLATES constant - PASSED
- [AC-005] Both generateIssueReport and generateSimpleQuestionIssueReport functions exist - PASSED

## Verification

```bash
# Type check (no errors in qa-patrol.spec.ts)
cd /home/ubuntu/Downloads/vow/frontend
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "qa-patrol"

# List tests (should list 9 tests)
npx playwright test e2e/qa-patrol.spec.ts --list
```

## Notes for Other Agents

- The template system is purely local - no network calls required
- All text generation is done through string template literals
- The `IssueConversationMessage` type is separate from the imported `ConversationMessage` to avoid naming conflicts
- Issue priority is determined programmatically based on test results and quality scores
