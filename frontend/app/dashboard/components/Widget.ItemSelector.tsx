'use client';

import React from 'react';

interface Item {
  id: string;
  name: string;
  color?: string | null;
}

interface ItemSelectorProps {
  availableItems: Item[];
  selectedItemIds: string[];
  onItemAdd: (itemId: string) => void;
  onItemRemove: (itemId: string) => void;
  placeholder?: string;
  itemColor?: string; // Default color for items without color
}

export default function ItemSelector({
  availableItems,
  selectedItemIds,
  onItemAdd,
  onItemRemove,
  placeholder = 'Add items...',
  itemColor = '#3b82f6'
}: ItemSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const selectedItems = availableItems.filter(item => selectedItemIds.includes(item.id));
  const unselectedItems = availableItems.filter(item => !selectedItemIds.includes(item.id));
  
  const filteredItems = unselectedItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
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

  const handleItemSelect = (itemId: string) => {
    onItemAdd(itemId);
    setSearchQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      {/* Selected Items */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedItems.map(item => (
            <div
              key={item.id}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm text-white"
              style={{ backgroundColor: item.color || itemColor }}
            >
              <span>{item.name}</span>
              <button
                onClick={() => onItemRemove(item.id)}
                className="hover:bg-white/20 rounded px-1"
                title="Remove item"
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
        {isOpen && filteredItems.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-10 w-full mt-1 rounded-lg border border-border bg-card shadow-lg max-h-60 overflow-y-auto"
          >
            {filteredItems.map(item => (
              <button
                key={item.id}
                onClick={() => handleItemSelect(item.id)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
              >
                <div
                  className="w-4 h-4 rounded flex-shrink-0"
                  style={{ backgroundColor: item.color || itemColor }}
                />
                <span className="text-gray-900 dark:text-white">{item.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* No results */}
        {isOpen && searchQuery && filteredItems.length === 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-10 w-full mt-1 rounded-lg border border-border bg-card shadow-lg p-3 text-center text-muted-foreground text-sm"
          >
            No matching items found
          </div>
        )}
      </div>
    </div>
  );
}
