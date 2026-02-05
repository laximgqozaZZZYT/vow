# E2E MOC Validation - SPEC Package

## 📋 Document Overview

This SPEC package provides a comprehensive enhancement plan for the VOW project's E2E testing infrastructure focused on MOCチャット機能 (MOC Chat function) automation and validation.

### Documents Included

| Document | Purpose | Size | Key Audience |
|----------|---------|------|--------------|
| **requirements.md** | Functional & non-functional requirements | 249 lines | Business, QA |
| **design.md** | Technical architecture & implementation patterns | 849 lines | Developers, QA |
| **tasks.md** | Detailed implementation tasks with code | 1,467 lines | Developers |
| **ANALYSIS.md** | Current state assessment & gap analysis | 512 lines | Tech leads, Architects |
| **README.md** | This file - overview & navigation | - | Everyone |

**Total**: 3,077 lines of comprehensive documentation

---

## 🎯 Executive Summary

### Current State
- ✅ Basic E2E test infrastructure exists
- ✅ 11 existing test cases (50-60% MOC coverage)
- ❌ Missing: multi-select, batch operations, refinement actions
- ❌ Missing: CI/CD integration
- ⚠️ Authentication needs strengthening for CI/CD

### Proposed Enhancement
- Add 12+ new E2E test cases
- Extend Page Object with 12 new methods
- Enhance logging with detailed scenario tracking
- Set up GitHub Actions CI/CD pipeline
- Achieve 85-90% MOC feature coverage

### Effort Estimate
- **Development**: 17.5 hours
- **Testing & Validation**: 2 hours
- **CI/CD Setup**: 1 hour
- **Total**: ~20.5 hours (1-2 sprints)

---

## 📚 How to Use This SPEC

### For Project Managers
1. Read **requirements.md** § Functional Requirements (5 min)
2. Review **ANALYSIS.md** § Recommended Implementation Order (5 min)
3. Check **tasks.md** § Task Summary table (3 min)

### For QA / Testers
1. Start with **requirements.md** (understand what's needed)
2. Review **design.md** § Test Implementation Pattern (see examples)
3. Follow **tasks.md** phases 3-7 (run the tests)

### For Developers (Implementing Tests)
1. Study **design.md** § Component Specifications (architecture)
2. Follow **tasks.md** phases 1-2 (extend Page Objects)
3. Reference **design.md** § Selector Strategy (how to find elements)

### For Backend Developers
1. Read **requirements.md** § Dependencies (understand APIs)
2. Check **design.md** § API Integration (what API calls are made)

### For DevOps / Infrastructure
1. Review **tasks.md** § Phase 8 (CI/CD setup)
2. Read **design.md** § CI/CD Integration

---

## 🔍 Quick Reference

### New Page Object Methods (12 methods)

**Multi-Select (5 methods)**
```
✅ toggleSuggestionCheckbox(index)
✅ selectAllSuggestions()
✅ clearAllSelections()
✅ getSelectedSuggestionCount()
✅ getSelectedSuggestionIndices()
```

**Action Buttons (3 methods)**
```
✅ clickRefineButton(actionType)
✅ clickBatchRegisterButton()
✅ getAllActionButtons()
```

**Badge Verification (3 methods)**
```
✅ getSuggestionBadgeInfo(index)
✅ verifyBadgeColors(expectedMapping)
✅ getSuggestionBadgeLabel(index)
```

**Logging (2 methods)**
```
✅ logSuggestionDetails(logger, index, suggestion)
✅ logUserAction(logger, actionType, details)
```

### New Test Files (5 files)

```
✅ moc-chat-flow.spec.ts         (3 guided flow tests)
✅ moc-candidates.spec.ts         (5 type/badge verification tests)
✅ moc-actions.spec.ts            (4 action button tests)
✅ moc-multi-select.spec.ts       (4 multi-select tests)
+ refinement tests (optional)
```

### CI/CD Changes

```
✅ .github/workflows/e2e-moc-validation.yml  (GitHub Actions)
✅ frontend/package.json scripts updated
✅ auth.fixture.ts enhanced for CI/CD
```

---

## 📊 Test Coverage Map

### MOC Feature Coverage

```
Information Type Selection ──┐
                             ├─→ moc-chat-flow.spec.ts (100%)
Category Selection ──────────┤
Subcategory Selection ───────┘

Habit Type Badge ─┐
Goal Type Badge ──┼─→ moc-candidates.spec.ts (100%)
Sticky'n Badge ───┤
Reply Type Badge ─┘

Accept Button ─┐
Reject Button ─┼─→ moc-actions.spec.ts (100%)
Snooze Button ─┤
Detail Modal ──┘

Select Individual ─┐
Select All ───────┼─→ moc-multi-select.spec.ts (100%)
Batch Register ───┤
Checkbox Toggle ──┘

Refine Specific ──┐
Refine General ───┼─→ (Future: moc-refinement.spec.ts)
Refine Easy/Hard ─┘
```

---

## 🚀 Getting Started

### Step 1: Review Documents (30 min)
```bash
# Read requirements first
cat /home/ubuntu/Downloads/vow/specs/e2e-moc-validation/requirements.md | less

# Then review design
cat /home/ubuntu/Downloads/vow/specs/e2e-moc-validation/design.md | less

# Understand current state
cat /home/ubuntu/Downloads/vow/specs/e2e-moc-validation/ANALYSIS.md | less
```

### Step 2: Identify Component Changes (30 min)

Check if `Section.MOC.tsx` has these new features:
- [ ] Checkbox in suggestion cards
- [ ] "Select All" toggle
- [ ] "もっと具体的に" button
- [ ] "選択した候補を登録" button

If not present, coordinate with Frontend team on implementation timeline.

### Step 3: Plan Implementation (15 min)

Decide on parallel vs. sequential:
- **Sequential**: Safer, ~20 hours (1-2 sprints)
- **Parallel**: Faster, ~10-12 hours (requires 2 developers)

Recommended: Sequential with Tester as lead, optional Backend support for CI/CD setup.

### Step 4: Start Phase 1 (Page Objects)

Follow **tasks.md** Phase 1:
1. Task 1.1: Multi-Select Methods (45 min)
2. Task 1.2: Action Button Methods (60 min)
3. Task 1.3: Badge Verification Methods (45 min)
4. Task 1.4: Logging Helpers (30 min)

---

## 🔗 Related Specifications

This SPEC interacts with:

| Related Spec | Relationship | Status |
|--------------|--------------|--------|
| `suggestion-button-enhancement` | Test recipient (tests new UI) | ℹ️ Implementation planned |
| `moc-mcp-remote-integration` | May affect chat API | ℹ️ In progress |
| `ai-agents-integration` | Background context | ✅ Reference only |

---

## 📝 Key Files Modified

### Core Test Infrastructure

| File | Changes | Impact |
|------|---------|--------|
| `e2e/page-objects/MOCSectionPage.ts` | +12 methods | 🟢 Critical |
| `e2e/utils/chat-logger.ts` | +3 methods, extended interfaces | 🟢 Critical |
| `e2e/utils/test-data.ts` | Extended definitions | 🟡 Medium |
| `e2e/fixtures/auth.fixture.ts` | +retry logic, env var support | 🟡 Medium |

### New Test Files

```
e2e/tests/chat/
├── moc-chat-flow.spec.ts           (NEW - 150 lines)
├── moc-candidates.spec.ts          (NEW - 180 lines)
├── moc-actions.spec.ts             (NEW - 120 lines)
└── moc-multi-select.spec.ts        (NEW - 160 lines)
```

### CI/CD

```
.github/workflows/
└── e2e-moc-validation.yml          (NEW - GitHub Actions)
```

---

## ✅ Quality Assurance Checklist

### Before Starting Implementation
- [ ] Read requirements.md § FR-001 through FR-008
- [ ] Review design.md § Architecture Overview
- [ ] Check ANALYSIS.md § Gap Analysis
- [ ] Verify MOC component changes are planned/completed
- [ ] Confirm dev server can run on localhost:3000

### During Implementation
- [ ] Each task has corresponding GitHub issue (optional but recommended)
- [ ] Page Object methods tested locally before use in scenarios
- [ ] Tests pass 2x in a row (not just once)
- [ ] No TypeScript compilation errors
- [ ] Chat logs have expected structure

### Before Merge
- [ ] All 5 test files pass
- [ ] CI/CD workflow configured and tested
- [ ] README documentation updated
- [ ] No breaking changes to existing tests
- [ ] Code review completed

---

## 📞 Support & Coordination

### Questions About Requirements
→ See **requirements.md** § Acceptance Criteria

### Technical Questions
→ See **design.md** § Component Specifications

### Implementation Questions
→ See **tasks.md** § Phase-specific details

### Integration with Frontend Changes
→ See **ANALYSIS.md** § Frontend Component Status

### Current Issues & Gaps
→ See **ANALYSIS.md** § Gap Analysis

---

## 📈 Success Metrics

### Quantitative Goals
- ✅ 15+ test cases (vs. current 11)
- ✅ 85-90% MOC feature coverage (vs. current 50-60%)
- ✅ 95%+ test success rate
- ✅ 20+ hours of development work

### Qualitative Goals
- ✅ Tests are maintainable and well-documented
- ✅ New tests can be added by QA without dev help
- ✅ CI/CD pipeline is self-healing (retries on flakes)
- ✅ Developers use logs to debug issues quickly

---

## 🎓 Learning Resources

### Playwright Testing Framework
- [Playwright Official Docs](https://playwright.dev/docs/intro)
- [Playwright Test Framework](https://playwright.dev/docs/test-intro)
- [Page Object Model Pattern](https://playwright.dev/docs/pom)

### VOW Project Context
- See `/home/ubuntu/Downloads/vow/CLAUDE.md` for project overview
- Check `/home/ubuntu/Downloads/vow/.kiro/steering/` for design patterns

### E2E Testing Best Practices
- Minimal UI selectors (use data-* attributes)
- Independent tests (no shared state)
- Clear assertions (what are you testing?)
- Proper wait strategies (not hardcoded sleeps)

---

## 🔄 Maintenance & Updates

### When Frontend Changes
1. Update selectors in `MOCSectionPage.ts`
2. Add new methods if new UI elements appear
3. Re-test moc-*.spec.ts files
4. Update selectors in this README if needed

### When API Changes
1. Update test scenarios in `test-data.ts`
2. Adjust timeout values if responses are slower
3. Document breaking changes in PR description

### Monthly Maintenance
1. Archive old chat logs (keep 30 days)
2. Review flaky tests and fix
3. Update ChatLogger if new data needed

---

## 📌 Version History

| Version | Date | Status | Notes |
|---------|------|--------|-------|
| 1.0 | 2026-02-05 | Draft | Initial SPEC created |
| - | - | - | Ready for implementation |

---

## 📞 Contact & Questions

For questions about this SPEC:
- **Researcher**: Initial analysis and design
- **Tester**: Implementation lead
- **DevOps**: CI/CD integration support

---

## 🎉 Next Steps

1. **This Week**: Review documentation, confirm alignment
2. **Next Week**: Start Phase 1 (Page Object extensions)
3. **Week 3-4**: Complete all phases, achieve full coverage
4. **Week 4**: Merge to develop, enable in CI/CD

**Expected Timeline**: 2-3 weeks for full implementation

---

*This SPEC was created as part of the VOW project's E2E testing infrastructure enhancement initiative. See `/home/ubuntu/Downloads/vow/specs/e2e-moc-validation/` for complete documentation.*

