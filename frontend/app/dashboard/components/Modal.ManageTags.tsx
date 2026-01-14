'use client';

import React from 'react';
import type { Tag } from '../types';

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
  const [isCreating, setIsCreating] = React.useState(false);

  if (!isOpen) return null;

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    
    try {
      await onCreateTag({ name: newTagName.trim(), color: newTagColor });
      setNewTagName('');
      setNewTagColor('#3b82f6');
      setIsCreating(false);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Manage Tags</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
              {/* Create New Tag */}
              <div className="mb-6">
            {!isCreating ? (
              <button
                onClick={() => setIsCreating(true)}
                className="w-full py-2 px-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 dark:hover:border-blue-400 dark:hover:text-blue-400 transition-colors"
              >
                + Create New Tag
              </button>
            ) : (
              <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Tag name"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    autoFocus
                  />
                  
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Color</label>
                    <div className="flex flex-wrap gap-2">
                      {predefinedColors.map((color) => (
                        <button
                          key={color}
                          onClick={() => setNewTagColor(color)}
                          className={`w-8 h-8 rounded-full border-2 ${
                            newTagColor === color ? 'border-gray-900 dark:border-white' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateTag}
                      disabled={!newTagName.trim()}
                      className="flex-1 py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => {
                        setIsCreating(false);
                        setNewTagName('');
                        setNewTagColor('#3b82f6');
                      }}
                      className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Existing Tags */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Existing Tags ({tags.length})
            </h3>
            
            {tags.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-8">
                No tags yet. Create your first tag above!
              </p>
            ) : (
              tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900"
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
                        className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        autoFocus
                      />
                      <button
                        onClick={() => handleUpdateTag(tag.id, { name: editingTag.name, color: editingTag.color })}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingTag(null)}
                        className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
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
                      <span className="flex-1 text-gray-900 dark:text-white">{tag.name}</span>
                      <button
                        onClick={() => setEditingTag(tag)}
                        className="px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTag(tag.id, tag.name)}
                        className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:underline"
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
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="py-2 px-6 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
