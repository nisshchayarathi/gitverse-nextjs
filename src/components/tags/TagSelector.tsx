'use client';

import { useState, useRef, useEffect } from 'react';
import { Tag } from '@/hooks/useTags';

interface Props {
  allTags: Tag[];
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  onClose: () => void;
}

export const TagSelector = ({ allTags, selectedTagIds, onChange, onClose }: Props) => {
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const filteredTags = allTags.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  const toggleTag = (id: string) => {
    if (selectedTagIds.includes(id)) {
      onChange(selectedTagIds.filter(tId => tId !== id));
    } else {
      onChange([...selectedTagIds, id]);
    }
  };

  return (
    <div ref={wrapperRef} className="absolute z-50 mt-1 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5">
      <div className="p-2">
        <input
          type="text"
          placeholder="Filter tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none focus:border-indigo-500"
          autoFocus
        />
      </div>
      <div className="max-h-60 overflow-y-auto">
        {filteredTags.length === 0 ? (
          <div className="px-3 py-2 text-sm text-gray-500">No tags found</div>
        ) : (
          filteredTags.map(tag => (
            <label
              key={tag.id}
              className="flex items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedTagIds.includes(tag.id)}
                onChange={() => toggleTag(tag.id)}
                className="mr-2 h-4 w-4 text-indigo-600 rounded border-gray-300"
              />
              <span
                className="inline-block w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: tag.color }}
              />
              <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{tag.name}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
};
