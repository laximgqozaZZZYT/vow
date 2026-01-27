'use client';

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';

/**
 * SmartSelector - 検索可能なマルチセレクトコンポーネント
 * 
 * Tags、Related Goals、Related Habitsの選択に使用する汎用コンポーネント。
 * - 検索入力によるフィルタリング
 * - 選択済みアイテムのChip表示
 * - キーボードナビゲーション（上下矢印、Enter、Escape）
 * - 最近使用したアイテムのサジェスト
 * 
 * @validates Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 7.1
 */

export interface SmartSelectorItem {
  id: string;
  name: string;
  color?: string;
  /** アイテムの種類（Habitのdo/avoid区別など） */
  variant?: 'default' | 'do' | 'avoid';
}

export interface SmartSelectorProps<T extends SmartSelectorItem> {
  /** 選択可能なアイテムのリスト */
  items: T[];
  /** 選択済みアイテムのIDリスト */
  selectedIds: string[];
  /** 選択時のコールバック */
  onSelect: (id: string) => void;
  /** 選択解除時のコールバック */
  onDeselect: (id: string) => void;
  /** 最近使用したアイテムのIDリスト（オプション、最大5件表示） */
  recentIds?: string[];
  /** プレースホルダーテキスト */
  placeholder?: string;
  /** 空状態のメッセージ */
  emptyMessage?: string;
  /** ラベル */
  label?: string;
  /** 無効化 */
  disabled?: boolean;
  /** コンパクトモード（Chip表示を小さく） */
  compact?: boolean;
}

export function SmartSelector<T extends SmartSelectorItem>({
  items,
  selectedIds,
  onSelect,
  onDeselect,
  recentIds = [],
  placeholder = 'Search and add...',
  emptyMessage = 'No items available',
  label,
  disabled = false,
  compact = false,
}: SmartSelectorProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // 選択済みアイテム
  const selectedItems = useMemo(() => 
    items.filter(item => selectedIds.includes(item.id)),
    [items, selectedIds]
  );

  // 未選択アイテム
  const unselectedItems = useMemo(() => 
    items.filter(item => !selectedIds.includes(item.id)),
    [items, selectedIds]
  );

  // 検索フィルタリング
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) {
      // 検索クエリが空の場合、最近使用したアイテムを優先表示
      const recentItems = recentIds
        .slice(0, 5)
        .map(id => unselectedItems.find(item => item.id === id))
        .filter((item): item is T => item !== undefined);
      
      const otherItems = unselectedItems.filter(
        item => !recentIds.includes(item.id)
      );
      
      return [...recentItems, ...otherItems];
    }
    
    const query = searchQuery.toLowerCase();
    return unselectedItems.filter(item =>
      item.name.toLowerCase().includes(query)
    );
  }, [unselectedItems, searchQuery, recentIds]);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        inputRef.current &&
        !inputRef.current.contains(target)
      ) {
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ハイライトされたアイテムをスクロールして表示
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  // キーボードナビゲーション
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex(prev => 
            prev < filteredItems.length - 1 ? prev + 1 : prev
          );
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (isOpen && highlightedIndex >= 0 && filteredItems[highlightedIndex]) {
          handleSelect(filteredItems[highlightedIndex].id);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(-1);
        break;
    }
  }, [disabled, isOpen, highlightedIndex, filteredItems]);

  const handleSelect = useCallback((id: string) => {
    onSelect(id);
    setSearchQuery('');
    setHighlightedIndex(-1);
    // ドロップダウンは開いたまま（連続選択を可能に）
    inputRef.current?.focus();
  }, [onSelect]);

  const handleDeselect = useCallback((id: string) => {
    onDeselect(id);
  }, [onDeselect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(-1);
  }, []);

  const handleInputFocus = useCallback(() => {
    if (!disabled) {
      setIsOpen(true);
    }
  }, [disabled]);

  // アイテムのバリアントに応じたスタイル
  const getVariantStyle = (variant?: string) => {
    switch (variant) {
      case 'do':
        return 'border-l-2 border-l-green-500';
      case 'avoid':
        return 'border-l-2 border-l-red-500';
      default:
        return '';
    }
  };

  const dropdownId = `smart-selector-dropdown-${label?.replace(/\s+/g, '-').toLowerCase() || 'default'}`;

  return (
    <div className="relative">
      {/* ラベル */}
      {label && (
        <label className="block text-sm font-medium mb-2 text-foreground">
          {label}
        </label>
      )}

      {/* 選択済みChip */}
      {selectedItems.length > 0 && (
        <div className={`flex flex-wrap gap-2 mb-2 ${compact ? 'gap-1' : ''}`}>
          {selectedItems.map(item => (
            <div
              key={item.id}
              className={`
                inline-flex items-center gap-1 rounded text-sm text-white
                transition-colors group
                ${compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1'}
                ${getVariantStyle(item.variant)}
              `}
              style={{ backgroundColor: item.color || 'var(--color-primary)' }}
            >
              <span className="truncate max-w-[150px]">{item.name}</span>
              <button
                type="button"
                onClick={() => handleDeselect(item.id)}
                disabled={disabled}
                className={`
                  hover:bg-white/20 rounded transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50
                  ${compact ? 'px-0.5' : 'px-1'}
                  ${disabled ? 'cursor-not-allowed opacity-50' : ''}
                `}
                aria-label={`Remove ${item.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 検索入力 */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            flex h-10 w-full rounded-md border border-input bg-background 
            px-3 py-2 text-sm placeholder:text-muted-foreground 
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
            ${disabled ? 'cursor-not-allowed opacity-50' : ''}
          `}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={dropdownId}
          aria-haspopup="listbox"
          aria-autocomplete="list"
        />

        {/* ドロップダウン */}
        {isOpen && !disabled && (
          <div
            ref={dropdownRef}
            id={dropdownId}
            className="absolute z-50 w-full mt-1 rounded-lg border border-border bg-card shadow-lg max-h-60 overflow-hidden"
            role="listbox"
          >
            {filteredItems.length > 0 ? (
              <ul ref={listRef} className="overflow-y-auto max-h-60">
                {/* 最近使用したアイテムのヘッダー */}
                {!searchQuery && recentIds.length > 0 && filteredItems.some(item => recentIds.includes(item.id)) && (
                  <li className="px-3 py-1.5 text-xs text-muted-foreground bg-muted/50 sticky top-0">
                    Recently used
                  </li>
                )}
                {filteredItems.map((item, index) => {
                  const isRecent = !searchQuery && recentIds.includes(item.id);
                  const isFirstNonRecent = !searchQuery && 
                    index > 0 && 
                    recentIds.includes(filteredItems[index - 1]?.id) && 
                    !recentIds.includes(item.id);
                  
                  return (
                    <React.Fragment key={item.id}>
                      {isFirstNonRecent && (
                        <li className="px-3 py-1.5 text-xs text-muted-foreground bg-muted/50">
                          All items
                        </li>
                      )}
                      <li
                        role="option"
                        aria-selected={highlightedIndex === index}
                        className={`
                          flex items-center gap-2 px-3 py-2 cursor-pointer
                          transition-colors min-h-[44px]
                          ${highlightedIndex === index 
                            ? 'bg-accent text-accent-foreground' 
                            : 'hover:bg-muted'
                          }
                          ${getVariantStyle(item.variant)}
                        `}
                        onClick={() => handleSelect(item.id)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                      >
                        {item.color && (
                          <div
                            className="w-4 h-4 rounded flex-shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                        )}
                        <span className="text-foreground truncate">{item.name}</span>
                        {item.variant && item.variant !== 'default' && (
                          <span className={`
                            text-xs px-1.5 py-0.5 rounded ml-auto
                            ${item.variant === 'do' ? 'bg-green-500/20 text-green-400' : ''}
                            ${item.variant === 'avoid' ? 'bg-red-500/20 text-red-400' : ''}
                          `}>
                            {item.variant}
                          </span>
                        )}
                      </li>
                    </React.Fragment>
                  );
                })}
              </ul>
            ) : (
              <div className="p-3 text-center text-muted-foreground text-sm">
                {searchQuery 
                  ? 'No matching items found' 
                  : emptyMessage
                }
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SmartSelector;
