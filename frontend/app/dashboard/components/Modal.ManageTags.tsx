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

    type TagWithChildren = Tag & { children: TagWithChildren[] };

    const traverse = (nodes: TagWithChildren[], currentLevel: number) => {
      nodes.forEach(node => {
        result.push({ ...node, level: currentLevel });
        if (node.children.length > 0) {
          traverse(node.children, currentLevel + 1);
        }
      });
    };

    traverse(hierarchy as TagWithChildren[], 0);
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
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200" 
      onClick={onClose}
    >
      <div 
        className="rounded-2xl border border-white/10 bg-[#1a1a1a] text-white shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Linear style with subtle gradient */}
        <div className="relative px-8 py-6 border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight">Manage Tags</h2>
              <p className="text-sm text-white/50">Organize your workflow with custom tags</p>
            </div>
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg w-8 h-8 text-white/40 hover:text-white/80 hover:bg-white/5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">
          {/* Create New Tag - Prominent card */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <span className="text-xs font-medium text-white/40 uppercase tracking-widest">Create New</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>
            
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 space-y-5 hover:border-white/20 transition-colors duration-200">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/70">Tag Name</label>
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="e.g., Priority, Design, Development..."
                  className="flex h-11 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/30 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 hover:border-white/20"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTagName.trim()) {
                      handleCreateTag();
                    }
                  }}
                />
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/70">Parent Tag</label>
                <select
                  value={newTagParentId || ''}
                  onChange={(e) => setNewTagParentId(e.target.value || null)}
                  className="flex h-11 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 hover:border-white/20"
                >
                  <option value="" className="bg-[#1a1a1a]">None (Root Tag)</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id} className="bg-[#1a1a1a]">
                      {tag.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-white/70">Color</label>
                <div className="flex flex-wrap gap-2.5">
                  {predefinedColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewTagColor(color)}
                      className={`relative w-10 h-10 rounded-lg transition-all duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
                        newTagColor === color ? 'scale-110 ring-2 ring-white/50 shadow-lg' : ''
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    >
                      {newTagColor === color && (
                        <svg className="absolute inset-0 m-auto w-5 h-5 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCreateTag}
                disabled={!newTagName.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:shadow-lg hover:shadow-blue-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none w-full active:scale-[0.98]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Tag
              </button>
            </div>
          </div>

          {/* Existing Tags */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <span className="text-xs font-medium text-white/40 uppercase tracking-widest">
                All Tags ({tags.length})
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>
            
            {tags.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.01] p-12 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 mb-4">
                  <svg className="w-8 h-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <p className="text-white/40 text-sm">
                  No tags yet. Create your first tag to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {hierarchicalTags.map((tag) => (
                  <div
                    key={tag.id}
                    className="group flex items-center gap-3 px-4 py-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-150"
                    style={{ marginLeft: `${tag.level * 24}px` }}
                  >
                    {editingTag?.id === tag.id ? (
                      <>
                        <input
                          type="color"
                          value={editingTag.color || '#3b82f6'}
                          onChange={(e) => setEditingTag({ ...editingTag, color: e.target.value })}
                          className="w-10 h-10 rounded-lg cursor-pointer flex-shrink-0 border border-white/20"
                        />
                        <div className="flex-1 flex flex-col gap-2">
                          <input
                            type="text"
                            value={editingTag.name}
                            onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                            className="flex h-10 rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-sm text-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            autoFocus
                          />
                          <select
                            value={editingTag.parentId || ''}
                            onChange={(e) => setEditingTag({ ...editingTag, parentId: e.target.value || null })}
                            className="flex h-10 rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-sm text-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          >
                            <option value="" className="bg-[#1a1a1a]">None (Root Tag)</option>
                            {tags
                              .filter(t => t.id !== tag.id)
                              .map((t) => (
                                <option key={t.id} value={t.id} className="bg-[#1a1a1a]">
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
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 flex-shrink-0"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Save
                        </button>
                        <button
                          onClick={() => setEditingTag(null)}
                          className="inline-flex items-center justify-center rounded-lg border border-white/10 hover:bg-white/5 px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 flex-shrink-0"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        {tag.level > 0 && (
                          <span className="text-white/20 flex-shrink-0 text-sm font-mono">└─</span>
                        )}
                        <div
                          className="w-10 h-10 rounded-lg flex-shrink-0 shadow-sm ring-1 ring-black/10"
                          style={{ backgroundColor: tag.color || '#3b82f6' }}
                        />
                        <span className="flex-1 font-medium text-white/90">{tag.name}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          <button
                            onClick={() => setEditingTag(tag)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 flex-shrink-0"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTag(tag.id, tag.name)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 flex-shrink-0"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer - Subtle with gradient */}
        <div className="px-8 py-5 border-t border-white/5 bg-gradient-to-t from-white/[0.02] to-transparent flex justify-end">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg border border-white/10 hover:bg-white/5 px-6 py-2.5 text-sm font-medium text-white/70 hover:text-white transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
