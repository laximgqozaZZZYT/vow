# Documentation Consolidation - Design Document

## Overview
- **Purpose**: ドキュメント整理の技術設計
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

## Current Document Structure

### Identified Document Locations

| Location | Purpose | Count |
|----------|---------|-------|
| `/CLAUDE.md` | エージェント向けプロジェクトガイド | 1 |
| `/.kiro/specs/` | 機能仕様書（Kiro形式） | ~60 |
| `/specs/` | 新規仕様書（MCP関連） | ~6 |
| `/docs/` | 運用・セットアップガイド | ~25 |
| `/.claude/coordination/` | エージェント調整 | 2 |

### Coordination Files (重複問題)

| File | Purpose | Last Updated |
|------|---------|--------------|
| `/.kiro/specs/COORDINATION.md` | AI Agents統合スプリント | Active |
| `/specs/COORDINATION.md` | MCP Remote統合スプリント | Active |
| `/.claude/coordination/BOARD.md` | エージェント割り当て | Active |

## Proposed Solution

### 1. Document Hierarchy

```
/CLAUDE.md (Entry Point)
    │
    ├── Document Map (読むべきドキュメントの優先順位)
    │
    ├── /.claude/coordination/BOARD.md (作業開始時に必読)
    │
    ├── Sprint Coordination
    │   ├── /.kiro/specs/COORDINATION.md (AI統合関連)
    │   └── /specs/COORDINATION.md (MCP統合関連)
    │
    ├── Feature Specs
    │   ├── /.kiro/specs/{feature}/ (既存機能)
    │   └── /specs/{feature}/ (新規・MCP関連)
    │
    └── Operations
        └── /docs/ (セットアップ・運用ガイド)
```

### 2. Document Map in CLAUDE.md

CLAUDE.mdに「Document Map」セクションを追加して、エージェントが読むべきドキュメントの優先順位を明確化。

**実装済み**: CLAUDE.mdにDocument Mapセクションが追加されています。

### 3. Specification Location Rules

| タイプ | Location | 理由 |
|--------|----------|------|
| MCP関連 | `/specs/` | MCPは外部システム連携 |
| 新規機能 | `/specs/` | 新しい仕様形式を使用 |
| 既存機能改修 | `/.kiro/specs/` | 既存のKiro形式を維持 |
| 運用ガイド | `/docs/` | 変更なし |

## Implementation Notes

### Already Completed

1. CLAUDE.mdにDocument Mapセクション追加済み
2. 正しいパス一覧を明記（MCPサーバー: `/home/ubuntu/.mcp-multi-agent/`）
3. specs/ディレクトリ構造の整理

### Remaining Work

1. 古いドキュメントのアーカイブ（該当があれば）
2. 各ドキュメントへのメタデータ（Last Updated, Author）追加
