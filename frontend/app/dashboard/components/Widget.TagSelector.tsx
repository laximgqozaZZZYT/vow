'use client';

import React from 'react';
import type { Tag } from '../types/index';

interface TagSelectorProps {
  availableTags: Tag[];
  selectedTagIds: string[];
  onTagAdd: (tagId: string) => void;
  onTagRemove: (tagId: string) => void;
  placeholder?: string;
}

export default function TagSelector({
  availableTags,
  selectedTagIds,
  onTagAdd,
  onTagRemove,
  placeholder = 'Add tags...'
}: TagSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const selectedTags = availableTags.filter(tag => selectedTagIds.includes(tag.id));
  const unselectedTags = availableTags.filter(tag => !selectedTagIds.includes(tag.id));
  
  const filteredTags = unselectedTags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTagSelect = (tagId: string) => {
    onTagAdd(tagId);
    setSearchQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedTags.map(tag => (
            <div
              key={tag.id}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm text-white"
              style={{ backgroundColor: tag.color || '#3b82f6' }}
            >
              <span>{tag.name}</span>
              <button
                onClick={() => onTagRemove(tag.id)}
                className="hover:bg-white/20 rounded px-1"
                title="Remove tag"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />

        {/* Dropdown */}
        {isOpen && filteredTags.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-10 w-full mt-1 rounded-lg border border-border bg-card shadow-lg max-h-60 overflow-y-auto"
          >
            {filteredTags.map(tag => (
              <button
                key={tag.id}
                onClick={() => handleTagSelect(tag.id)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
              >
                <div
                  className="w-4 h-4 rounded flex-shrink-0"
                  style={{ backgroundColor: tag.color || '#3b82f6' }}
                />
                <span className="text-gray-900 dark:text-white">{tag.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* No results */}
        {isOpen && searchQuery && filteredTags.length === 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-10 w-full mt-1 rounded-lg border border-border bg-card shadow-lg p-3 text-center text-muted-foreground text-sm"
          >
            No matching tags found
          </div>
        )}
      </div>
    </div>
  );
}
