'use client';

import { useState } from 'react';
import { Tag } from '@/hooks/useTags';

const PRESET_COLORS = [
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Orange', value: '#f97316' },
];

interface Props {
  tags: Tag[];
  onCreateTag: (name: string, color: string) => Promise<any>;
  onDeleteTag?: (id: string) => Promise<any>;
  activeFilter?: string[];
  onFilterChange?: (tags: string[]) => void;
}

export const TagManager = ({ tags, onCreateTag, onDeleteTag, activeFilter = [], onFilterChange }: Props) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await onCreateTag(newName.trim(), newColor);
      setNewName('');
      setIsCreating(false);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleFilter = (tagId: string) => {
    if (!onFilterChange) return;
    if (activeFilter.includes(tagId)) {
      onFilterChange(activeFilter.filter(id => id !== tagId));
    } else {
      onFilterChange([...activeFilter, tagId]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Tags</h3>
        <button 
          onClick={() => setIsCreating(!isCreating)} 
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          {isCreating ? 'Cancel' : '+ New Tag'}
        </button>
      </div>

      {isCreating && (
        <div className="flex flex-col gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Tag name..."
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <div className="flex gap-1.5 flex-wrap">
            {PRESET_COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => setNewColor(c.value)}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${newColor === c.value ? 'border-gray-900 dark:border-gray-100 scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c.value }}
                title={c.name}
              />
            ))}
          </div>
          <button 
            onClick={handleCreate} 
            disabled={!newName.trim()}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            Create Tag
          </button>
        </div>
      )}

      {tags.length === 0 && !isCreating ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">No tags created yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => {
            const isActive = activeFilter.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => toggleFilter(tag.id)}
                className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${isActive ? 'ring-2 ring-offset-1 dark:ring-offset-gray-900 ring-indigo-500' : 'hover:opacity-80'}`}
                style={{ 
                  backgroundColor: `${tag.color}20`, 
                  color: tag.color, 
                  border: `1px solid ${tag.color}40` 
                }}
              >
                <span>{tag.name}</span>
                <span className="opacity-70 text-[10px]">({tag._count?.repos ?? 0})</span>
                {onDeleteTag && (
                  <span 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTag(tag.id);
                    }}
                    className="ml-1 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
                    title="Delete tag"
                  >
                    &times;
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
