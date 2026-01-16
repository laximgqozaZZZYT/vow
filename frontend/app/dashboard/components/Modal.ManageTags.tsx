'use client';

import React from 'react';
import type { Tag } from '../types/index';

interface ManageTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tags: Tag[];
  onCreateTag: (payload: { name: string; color?: string; parentId?: string | null }) => Promise<void>;
  onUpdateTag: (id: string, payload: { name?: string; color?: string; parentId?: string | null }) => Promise<void>;
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
  const [newTagParentId, setNewTagParentId] = React.useState<string | null>(null);

  if (!isOpen) return null;

  // タグの階層構造を構築
  const buildTagHierarchy = (tags: Tag[]): Tag[] => {
    const tagMap = new Map<string, Tag & { children: Tag[] }>();
    const rootTags: (Tag & { children: Tag[] })[] = [];

    // すべてのタグをマップに追加
    tags.forEach(tag => {
      tagMap.set(tag.id, { ...tag, children: [] });
    });

    // 親子関係を構築
    tags.forEach(tag => {
      const tagWithChildren = tagMap.get(tag.id)!;
      if (tag.parentId && tagMap.has(tag.parentId)) {
        tagMap.get(tag.parentId)!.children.push(tagWithChildren);
      } else {
        rootTags.push(tagWithChildren);
      }
    });

    return rootTags;
  };

  // タグを階層的にフラット化（表示用）
  const flattenTagHierarchy = (tags: Tag[], level = 0): Array<Tag & { level: number }> => {
    const result: Array<Tag & { level: number }> = [];
    const hierarchy = buildTagHierarchy(tags);

    const traverse = (nodes: (Tag & { children: Tag[] })[], currentLevel: number) => {
      nodes.forEach(node => {
        result.push({ ...node, level: currentLevel });
        if (node.children.length > 0) {
          traverse(node.children, currentLevel + 1);
        }
      });
    };

    traverse(hierarchy, 0);
    return result;
  };

  const hierarchicalTags = flattenTagHierarchy(tags);

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    
    try {
      await onCreateTag({ name: newTagName.trim(), color: newTagColor, parentId: newTagParentId });
      setNewTagName('');
      setNewTagColor('#3b82f6');
      setNewTagParentId(null);
    } catch (error) {
      console.error('Failed to create tag:', error);
      alert('Failed to create tag');
    }
  };

  const handleUpdateTag = async (id: string, updates: { name?: string; color?: string; parentId?: string | null }) => {
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
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Parent Tag (Optional)</label>
                  <select
                    value={newTagParentId || ''}
                    onChange={(e) => setNewTagParentId(e.target.value || null)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <option value="">None (Root Tag)</option>
                    {tags.map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name}
                      </option>
                    ))}
                  </select>
                </div>

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
              hierarchicalTags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors"
                  style={{ marginLeft: `${tag.level * 24}px` }}
                >
                  {editingTag?.id === tag.id ? (
                    <>
                      <input
                        type="color"
                        value={editingTag.color || '#3b82f6'}
                        onChange={(e) => setEditingTag({ ...editingTag, color: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer flex-shrink-0"
                      />
                      <div className="flex-1 flex flex-col gap-2">
                        <input
                          type="text"
                          value={editingTag.name}
                          onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                          className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          autoFocus
                        />
                        <select
                          value={editingTag.parentId || ''}
                          onChange={(e) => setEditingTag({ ...editingTag, parentId: e.target.value || null })}
                          className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <option value="">None (Root Tag)</option>
                          {tags
                            .filter(t => t.id !== tag.id) // 自分自身は選択できない
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                        </select>
                      </div>
                      <button
                        onClick={() => handleUpdateTag(tag.id, { 
                          name: editingTag.name, 
                          color: editingTag.color,
                          parentId: editingTag.parentId 
                        })}
                        className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary flex-shrink-0"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingTag(null)}
                        className="inline-flex items-center justify-center rounded-md border border-input px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary flex-shrink-0"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      {tag.level > 0 && (
                        <span className="text-muted-foreground flex-shrink-0">└─</span>
                      )}
                      <div
                        className="w-8 h-8 rounded flex-shrink-0"
                        style={{ backgroundColor: tag.color || '#3b82f6' }}
                      />
                      <span className="flex-1">{tag.name}</span>
                      <button
                        onClick={() => setEditingTag(tag)}
                        className="px-3 py-1.5 text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded flex-shrink-0"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTag(tag.id, tag.name)}
                        className="px-3 py-1.5 text-sm text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded flex-shrink-0"
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
