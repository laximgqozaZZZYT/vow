/**
 * useNestedStickies - Sticky'nのネスト構造を管理するフック
 *
 * 機能:
 * - フラット配列からツリー構造への変換
 * - 子Sticky'nの追加・削除・移動
 * - ドラッグ&ドロップでの並び替え・ネスト変更
 * - 最大3階層の深さ制限
 */

import { useState, useCallback, useMemo } from 'react';
import type { Sticky } from '../types/index';

/** ネストの最大深さ */
export const MAX_NESTING_DEPTH = 2; // 0, 1, 2 = 3階層

/** 展開状態のレコード */
export type ExpandedState = Record<string, boolean>;

/** ネスト変更操作 */
export interface NestingChange {
  stickyId: string;
  newParentId: string | null;
  newDisplayOrder: number;
}

/**
 * フラット配列をツリー構造に変換
 */
export function buildNestedTree(stickies: Sticky[]): Sticky[] {
  const stickyMap = new Map<string, Sticky>();
  const rootStickies: Sticky[] = [];

  // まずすべてのStickyをマップに登録し、childrenを初期化
  stickies.forEach(sticky => {
    stickyMap.set(sticky.id, { ...sticky, children: [], depth: 0 });
  });

  // 再帰的に深さを計算する関数
  const calculateDepth = (stickyId: string, visited: Set<string> = new Set()): number => {
    // 循環参照防止
    if (visited.has(stickyId)) return 0;
    visited.add(stickyId);

    const sticky = stickyMap.get(stickyId);
    if (!sticky) return 0;

    if (!sticky.parentStickyId || !stickyMap.has(sticky.parentStickyId)) {
      return 0;
    }

    return calculateDepth(sticky.parentStickyId, visited) + 1;
  };

  // 全てのStickyの深さを正しく計算
  stickies.forEach(sticky => {
    const current = stickyMap.get(sticky.id)!;
    current.depth = calculateDepth(sticky.id);
  });

  // 親子関係を構築
  stickies.forEach(sticky => {
    const current = stickyMap.get(sticky.id)!;

    if (sticky.parentStickyId && stickyMap.has(sticky.parentStickyId)) {
      const parent = stickyMap.get(sticky.parentStickyId)!;
      // 最大深さチェック
      if (current.depth! <= MAX_NESTING_DEPTH) {
        parent.children = parent.children || [];
        parent.children.push(current);
      } else {
        // 深さ制限を超える場合はルートとして扱う
        current.depth = 0;
        rootStickies.push(current);
      }
    } else {
      current.depth = 0;
      rootStickies.push(current);
    }
  });

  // 各レベルでdisplayOrderでソート
  const sortChildren = (items: Sticky[]): Sticky[] => {
    return items
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .map(item => ({
        ...item,
        children: item.children ? sortChildren(item.children) : []
      }));
  };

  return sortChildren(rootStickies);
}

/**
 * ツリー構造をフラット配列に変換（描画順）
 */
export function flattenTree(tree: Sticky[]): Sticky[] {
  const result: Sticky[] = [];

  const traverse = (items: Sticky[]) => {
    items.forEach(item => {
      result.push(item);
      if (item.children && item.children.length > 0) {
        traverse(item.children);
      }
    });
  };

  traverse(tree);
  return result;
}

/**
 * Stickyの深さを取得
 */
export function getStickyDepth(stickyId: string, stickies: Sticky[]): number {
  const sticky = stickies.find(s => s.id === stickyId);
  if (!sticky) return 0;

  if (!sticky.parentStickyId) return 0;

  return 1 + getStickyDepth(sticky.parentStickyId, stickies);
}

/**
 * ネスト可能かどうかをチェック
 */
export function canNestUnder(
  childId: string,
  parentId: string | null,
  stickies: Sticky[]
): boolean {
  if (!parentId) return true; // ルートへ移動は常にOK
  if (childId === parentId) return false; // 自分自身の下には配置不可

  // 親の深さをチェック
  const parentDepth = getStickyDepth(parentId, stickies);
  if (parentDepth >= MAX_NESTING_DEPTH) return false;

  // 循環参照チェック（子孫に親がいないか）
  const descendants = getDescendants(childId, stickies);
  if (descendants.includes(parentId)) return false;

  return true;
}

/**
 * 指定Stickyの全子孫を取得
 */
export function getDescendants(stickyId: string, stickies: Sticky[]): string[] {
  const children = stickies.filter(s => s.parentStickyId === stickyId);
  const descendants: string[] = [];

  children.forEach(child => {
    descendants.push(child.id);
    descendants.push(...getDescendants(child.id, stickies));
  });

  return descendants;
}

/**
 * 利用可能な親Stickyのリストを取得（自身と子孫を除外）
 */
export function getAvailableParents(
  currentId: string | null,
  stickies: Sticky[]
): Sticky[] {
  if (!currentId) {
    // 新規作成時: 深さ0-1のStickyのみ選択可能
    return stickies.filter(s => (s.depth ?? 0) < MAX_NESTING_DEPTH);
  }

  const descendants = getDescendants(currentId, stickies);
  return stickies.filter(s =>
    s.id !== currentId &&
    !descendants.includes(s.id) &&
    (s.depth ?? 0) < MAX_NESTING_DEPTH
  );
}

/**
 * useNestedStickies フック
 */
export function useNestedStickies(initialStickies: Sticky[]) {
  const [expandedState, setExpandedState] = useState<ExpandedState>({});

  // ツリー構造にビルド
  const nestedTree = useMemo(() =>
    buildNestedTree(initialStickies),
    [initialStickies]
  );

  // フラット化された表示用リスト
  const flattenedList = useMemo(() =>
    flattenTree(nestedTree),
    [nestedTree]
  );

  // 展開状態を考慮した可視リスト
  const visibleList = useMemo(() => {
    const result: Sticky[] = [];

    const traverse = (items: Sticky[], parentExpanded: boolean) => {
      items.forEach(item => {
        if (parentExpanded) {
          result.push(item);
          const isExpanded = expandedState[item.id] ?? true; // デフォルトで展開
          if (item.children && item.children.length > 0) {
            traverse(item.children, isExpanded);
          }
        }
      });
    };

    traverse(nestedTree, true);
    return result;
  }, [nestedTree, expandedState]);

  // 展開/折りたたみトグル
  const toggleExpanded = useCallback((stickyId: string) => {
    setExpandedState(prev => ({
      ...prev,
      [stickyId]: !(prev[stickyId] ?? true)
    }));
  }, []);

  // すべて展開
  const expandAll = useCallback(() => {
    const newState: ExpandedState = {};
    initialStickies.forEach(s => {
      newState[s.id] = true;
    });
    setExpandedState(newState);
  }, [initialStickies]);

  // すべて折りたたみ
  const collapseAll = useCallback(() => {
    const newState: ExpandedState = {};
    initialStickies.forEach(s => {
      newState[s.id] = false;
    });
    setExpandedState(newState);
  }, [initialStickies]);

  // 特定のStickyが展開されているか
  const isExpanded = useCallback((stickyId: string) => {
    return expandedState[stickyId] ?? true;
  }, [expandedState]);

  // 子があるか
  const hasChildren = useCallback((stickyId: string) => {
    return initialStickies.some(s => s.parentStickyId === stickyId);
  }, [initialStickies]);

  // 利用可能な親リスト取得
  const getParentOptions = useCallback((currentId: string | null) => {
    return getAvailableParents(currentId, initialStickies);
  }, [initialStickies]);

  // ネスト可能チェック
  const checkCanNest = useCallback((childId: string, parentId: string | null) => {
    return canNestUnder(childId, parentId, initialStickies);
  }, [initialStickies]);

  return {
    // データ
    nestedTree,
    flattenedList,
    visibleList,

    // 展開状態
    expandedState,
    toggleExpanded,
    expandAll,
    collapseAll,
    isExpanded,

    // ユーティリティ
    hasChildren,
    getParentOptions,
    checkCanNest,
  };
}

export default useNestedStickies;
