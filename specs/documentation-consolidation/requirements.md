# Documentation Consolidation - Requirements Specification

## Overview

- **Purpose**: VOWプロジェクトの散逸したドキュメントを整理・統合し、エージェント間の混乱を防ぐ
- **Status**: Draft
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

## Problem Statement

### 現状の問題点

1. **ドキュメントの散逸**
   - 複数の場所に類似したドキュメントが存在
   - `.kiro/specs/` に約60件の仕様書
   - `/specs/` に新規仕様書（増加中）
   - `/docs/` に約25件の運用ドキュメント
   - プロジェクトルートに6件のMarkdownファイル

2. **COORDINATIONファイルの分断**
   - `/.kiro/specs/COORDINATION.md` - AI Agents統合スプリント
   - `/specs/COORDINATION.md` - MCP Remote統合スプリント
   - `/.claude/coordination/BOARD.md` - エージェント割り当て
   - 3つの場所に調整情報が分散

3. **参照パス混乱**
   - 同じ内容が異なるパスで参照される
   - 相対パスと絶対パスの混在
   - エージェントがどのドキュメントを優先すべきか不明確

## Requirements

### Functional Requirements

- **[FR-001]** ドキュメントの階層構造を明確に定義する
- **[FR-002]** 各ドキュメントの役割を一意に定義し、重複を排除する
- **[FR-003]** COORDINATIONファイルを統合または明確に役割分担する
- **[FR-004]** 全ドキュメントに更新日とバージョンを記載する
- **[FR-005]** エージェント向けの読むべきドキュメント優先順位を明確化する

### Non-Functional Requirements

- **[NFR-001]** 新規エージェントが5分以内に必要なドキュメントにアクセスできる
- **[NFR-002]** ドキュメント構造がCLAUDE.mdから全体像を把握できる

## Scope

### In Scope
- プロジェクトルートのMarkdownファイル
- `.kiro/specs/` 内の仕様書
- `/specs/` 内の仕様書
- `/docs/` 内の運用ドキュメント

### Out of Scope
- `node_modules/` 内のドキュメント
- 自動生成ドキュメント

## Success Criteria

- エージェントがどのドキュメントを読むべきか1分以内に判断できる
- 重複ドキュメントがゼロになる
