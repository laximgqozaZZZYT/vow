# MOC Section Chat Feature v2.0 - Complete Specification

**Status**: Active Specification
**Version**: 2.0.0
**Created**: 2026-02-05
**Location**: `/home/ubuntu/Downloads/vow/specs/moc-chat-v2/`

---

## Overview

This specification defines the complete MOC (Multi-agent Orchestration Center) chat feature for the VOW habit tracker application, including candidate button display (4 types), segment-by-segment conversation flow, and comprehensive error handling.

---

## Document Structure

### 1. ANALYSIS_REPORT.md (Current State Analysis)
- **Purpose**: Detailed analysis of current implementation
- **Content**:
  - Architecture overview
  - Feature completion status (85% complete)
  - Issue analysis (5 identified issues)
  - Code quality review
  - Recommendations (21 items)
- **Audience**: Architects, Tech Leads, Code Reviewers
- **Length**: ~60 pages

### 2. requirements.md (Functional Requirements)
- **Purpose**: Define what the feature should do
- **Content**:
  - 10 Functional Requirements (FR-001 to FR-010)
  - 5 Non-Functional Requirements (NFR-001 to NFR-005)
  - 10 Acceptance Criteria (AC-001 to AC-010)
  - Success metrics
- **Audience**: Product Managers, Developers, QA
- **Format**: KIRO Specification format

### 3. design.md (Technical Design)
- **Purpose**: How the feature is implemented
- **Content**:
  - Architecture and component hierarchy
  - Data flow diagrams
  - Component specifications (6 components)
  - State management design
  - Flow diagrams
  - Error handling design
  - Interaction design
  - Performance considerations
  - Testing strategy
  - Localization design
- **Audience**: Developers, Architects
- **Format**: Technical specification

### 4. tasks.md (Implementation Tasks)
- **Purpose**: Actionable implementation items
- **Content**:
  - 24 implementation tasks
  - 7 implementation phases
  - 3-week implementation timeline
  - Dependencies and prerequisites
  - Success criteria per phase
  - Risk mitigation strategies
  - Quality gates
- **Audience**: Implementation Team, Project Managers
- **Estimated Effort**: 48 hours (6 working days)

---

## Current Status Summary

### Working Features (100%)
- Message type system
- Suggestion button types (4 types)
- Parsing function architecture
- Action button system (Accept/Snooze/Dismiss)
- Tool call processing
- Modal integration
- Quick reply system

### Partially Working (70-90%)
- Follow-up action buttons
- Conversation flow state machine
- Selection type awareness

### Missing/Incomplete (0-50%)
- Session conversation memory
- Suggestion history & analytics
- Accessibility features
- Comprehensive error recovery
- Localization for all tool outputs

---

## Key Issues Found

| Issue # | Title | Severity | Frequency |
|---------|-------|----------|-----------|
| 1 | Candidate buttons not always displayed | Medium | 5-10% |
| 2 | Wrong tool called after category selection | High | 2-3% |
| 3 | Modal opens with incomplete data | Medium | 15-20% |
| 4 | Multiple suggestions overflow | Low | 30% |
| 5 | Selection type lost in refine actions | Medium | 40% |

**Recommendation**: Implement all Priority 1 tasks (Tasks 1.1-1.4, 2.1-2.5, 3.1-3.4) to resolve these issues.

---

## Implementation Roadmap

### Phase 1: Core Flow & Parsing (Week 1, 20 hours)
- Flow state machine
- Selection type routing
- Parsing function extraction and enhancement
- Suggestion caching

### Phase 2: Backend Enhancement (Week 2, 16 hours)
- System prompt improvement
- Tool output validation
- Exclusion list support
- Logging enhancements

### Phase 3: Error Handling (Week 2, 8 hours)
- Error detection and logging
- User-friendly error messages
- Modal error recovery
- Selection type validation

### Phase 4: Modal Integration (Week 2, 4 hours)
- Modal data pre-filling
- Success flow integration

### Phase 5: Testing (Week 3, 6 hours)
- Unit tests (50+ tests)
- Integration tests (20+ tests)
- E2E tests (Playwright)
- Manual testing checklist

### Phase 6: Documentation (Week 3, 2 hours)
- Code documentation
- Release notes
- Changelog

---

## Critical Success Factors

1. **Flow State Machine**: Must prevent wrong tool calls after category selection
2. **Robust Parsing**: Must handle 90%+ of tool output variations
3. **Error Recovery**: Must gracefully handle all error scenarios
4. **Testing**: Must achieve >80% code coverage

---

## Key Files

### Frontend
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx` (4,324 lines)
  - Main component (needs refactoring)
  - Contains: parsing functions, event handlers, UI rendering

### Backend
- `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/vow-coach-agent.ts` (4,224+ lines)
  - AI agent orchestration
  - System prompt definition

- `/home/ubuntu/Downloads/vow/backend/src/agents/shared-tools/coach-tools.ts` (4,224 lines)
  - Tool definitions and schemas
  - 12+ tool types

---

## Dependencies

### Frontend
- React 19
- TypeScript 5.3+
- Mastra framework
- Zod for validation

### Backend
- Node.js 18+
- Mastra
- OpenAI API
- Supabase

### Testing
- Jest
- Playwright 1.40+
- React Testing Library

---

## Success Metrics

- **Button display accuracy**: ≥98%
- **Correct tool routing**: ≥95%
- **User satisfaction**: ≥4.0/5.0
- **Feature usage**: ≥80% of chat interactions
- **Error rate**: <2%
- **Code coverage**: >80%

---

## Related Specifications

- **ISS-20260204-031**: Goal/Habit button type fix (✅ Completed)
- **ISS-20260204-030**: Habit multiple display fix (✅ Completed)
- **ISS-1b9a14fe**: Goal button display fix (✅ Completed)
- **E2E-CHAT-001**: E2E test specification (✅ Completed)
- **Category-Drilldown**: Drilldown question flow (✅ Completed)

---

## Quick Start for Developers

### To understand the feature:
1. Read `requirements.md` (10 min)
2. Review `design.md` Architecture section (15 min)
3. Check ANALYSIS_REPORT.md for current status (20 min)

### To implement:
1. Start with Phase 1 tasks (Tasks 1.1-1.4)
2. Follow the task breakdown in `tasks.md`
3. Use dependencies and prerequisites as guide
4. Run quality gates after each phase

### To test:
1. Run unit tests: `npm test` (from Phase 6.1)
2. Run integration tests: `npm run test:integration` (Phase 6.2)
3. Run E2E tests: `npm run test:e2e` (Phase 6.3)
4. Manual testing checklist from Phase 6.4

---

## Questions & Support

### For Specification Questions
Contact: vow-spec-architect

### For Implementation Questions
- Review design.md sections 2-4
- Check ANALYSIS_REPORT.md recommendations
- Review existing related specifications

### For Technical Debt
Document in Github issues with label `moc-chat-debt`

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-04 | MOC chat improvement spec (predecessor) |
| 2.0 | 2026-02-05 | Complete rewrite: added flow state machine, error handling, comprehensive testing strategy |

---

## Sign-off

**Specification Lead**: vow-spec-architect
**Created**: 2026-02-05
**Status**: Active
**Next Review**: After Phase 3 completion

---

## Appendix: File Summary

```
/home/ubuntu/Downloads/vow/specs/moc-chat-v2/
├── README.md (this file)
├── ANALYSIS_REPORT.md (current state analysis)
├── requirements.md (functional & non-functional requirements)
├── design.md (technical design & architecture)
└── tasks.md (implementation tasks & timeline)

Total: 4 files, ~200 pages
```

---
