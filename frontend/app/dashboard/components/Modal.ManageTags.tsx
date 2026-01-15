'use client';

import React from 'react';
import type { Tag } from '../types/index';

interface ManageTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tags: Tag[];
  onCreateTag: (payload: { name: string; color?: string }) => Promise<void>;
  onUpdateTag: (id: string, payload: { name?: string; color?: string }) => Promise<void>;
  onDeleteTag: (id: string) => Promise<void>;
}

export default function ManageTagsModal({
  isOpen,
  onClose,
  tags,
  onCreateTag,
  onUpdateTag,
  onDeleteTag
}: ManageTagsModalProps) {
  const [editingTag, setEditingTag] = React.useState<Tag | null>(null);
  const [newTagName, setNewTagName] = React.useState('');
  const [newTagColor, setNewTagColor] = React.useState('#3b82f6');

  if (!isOpen) return null;

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    
    try {
      await onCreateTag({ name: newTagName.trim(), color: newTagColor });
      setNewTagName('');
      setNewTagColor('#3b82f6');
    } catch (error) {
      console.error('Failed to create tag:', error);
      alert('Failed to create tag');
    }
  };

  const handleUpdateTag = async (id: string, updates: { name?: string; color?: string }) => {
    try {
      await onUpdateTag(id, updates);
      setEditingTag(null);
    } catch (error) {
      console.error('Failed to update tag:', error);
      alert('Failed to update tag');
    }
  };

  const handleDeleteTag = async (id: string, name: string) => {
    if (!confirm(`Delete tag "${name}"? This will remove it from all Habits, Goals, and Diary Cards.`)) {
      return;
    }
    
    try {
      await onDeleteTag(id);
    } catch (error) {
      console.error('Failed to delete tag:', error);
      alert('Failed to delete tag');
    }
  };

  const predefinedColors = [
    '#ef4444', // red
    '#f97316', // orange
    '#f59e0b', // amber
    '#eab308', // yellow
    '#84cc16', // lime
    '#22c55e', // green
    '#10b981', // emerald
    '#14b8a6', // teal
    '#06b6d4', // cyan
    '#0ea5e9', // sky
    '#3b82f6', // blue
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#a855f7', // purple
    '#d946ef', // fuchsia
    '#ec4899', // pink
    '#f43f5e', // rose
    '#64748b', // slate
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="rounded-lg border border-border bg-card text-card-foreground shadow-lg w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">Manage Tags</h2>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md w-8 h-8 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Create New Tag - Always visible */}
          <div className="mb-6">
            <div className="rounded-lg border border-border bg-muted p-4">
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Tag name"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTagName.trim()) {
                      handleCreateTag();
                    }
                  }}
                />
                
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {predefinedColors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewTagColor(color)}
                        className={`w-8 h-8 rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          newTagColor === color ? 'border-primary' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim()}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </div>
          </div>

          {/* Existing Tags */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Existing Tags ({tags.length})
            </h3>
            
            {tags.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                No tags yet. Create your first tag above!
              </p>
            ) : (
              tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors"
                >
                  {editingTag?.id === tag.id ? (
                    <>
                      <input
                        type="color"
                        value={editingTag.color || '#3b82f6'}
                        onChange={(e) => setEditingTag({ ...editingTag, color: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={editingTag.name}
                        onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                        className="flex-1 flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        autoFocus
                      />
                      <button
                        onClick={() => handleUpdateTag(tag.id, { name: editingTag.name, color: editingTag.color })}
                        className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingTag(null)}
                        className="inline-flex items-center justify-center rounded-md border border-input px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <div
                        className="w-8 h-8 rounded flex-shrink-0"
                        style={{ backgroundColor: tag.color || '#3b82f6' }}
                      />
                      <span className="flex-1">{tag.name}</span>
                      <button
                        onClick={() => setEditingTag(tag)}
                        className="px-3 py-1.5 text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTag(tag.id, tag.name)}
                        className="px-3 py-1.5 text-sm text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md bg-secondary px-6 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
