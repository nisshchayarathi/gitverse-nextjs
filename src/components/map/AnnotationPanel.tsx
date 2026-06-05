import React, { useState } from 'react';
import { MapAnnotation } from '@/services/annotationService';
import { MessageSquare, AlertTriangle, Bug, Wrench, FileText, Link as LinkIcon, Search, Filter, X } from 'lucide-react';

interface AnnotationPanelProps {
  annotations: MapAnnotation[];
  isOpen: boolean;
  onClose: () => void;
  onSelect: (annotation: MapAnnotation) => void;
}

const typeIcons = {
  'comment': MessageSquare,
  'warning': AlertTriangle,
  'technical-debt': Bug,
  'refactor': Wrench,
  'documentation': FileText,
  'issue-link': LinkIcon,
};

export const AnnotationPanel: React.FC<AnnotationPanelProps> = ({ annotations, isOpen, onClose, onSelect }) => {
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filtered = annotations.filter(a => {
    if (filter !== 'all' && a.annotationType !== filter) return false;
    if (search && !a.content.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="absolute right-0 top-0 h-full w-80 glass border-l border-white/10 z-30 flex flex-col transform transition-transform shadow-2xl">
      <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40">
        <h3 className="font-semibold text-lg text-white">Annotations</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X size={20} />
        </button>
      </div>

      <div className="p-4 space-y-3 border-b border-white/10 bg-black/20">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="Search annotations..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0f172a] text-white border border-white/10 rounded pl-9 pr-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        
        <div className="flex gap-2">
          <Filter className="text-gray-400 mt-2" size={16} />
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 bg-[#0f172a] text-white border border-white/10 rounded px-2 py-1.5 text-sm outline-none focus:border-primary"
          >
            <option value="all">All Types</option>
            <option value="comment">Comments</option>
            <option value="warning">Warnings</option>
            <option value="technical-debt">Technical Debt</option>
            <option value="refactor">Refactor</option>
            <option value="documentation">Documentation</option>
            <option value="issue-link">Issue Links</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-black/10">
        {filtered.length === 0 ? (
          <div className="text-center text-gray-500 text-sm mt-8">
            No annotations found.
          </div>
        ) : (
          filtered.map(annotation => {
            const Icon = typeIcons[annotation.annotationType] || MessageSquare;
            return (
              <div 
                key={annotation.id}
                onClick={() => onSelect(annotation)}
                className="bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 cursor-pointer transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className="text-primary" />
                    <span className="text-xs font-medium capitalize text-gray-300">
                      {annotation.annotationType.replace('-', ' ')}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500">
                    {new Date(annotation.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm line-clamp-3 text-gray-200">{annotation.content}</p>
                <div className="mt-2 flex items-center gap-2">
                  {annotation.author?.image ? (
                    <img src={annotation.author.image} alt="author" className="w-5 h-5 rounded-full" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] text-primary">
                      {annotation.author?.name?.[0] || 'U'}
                    </div>
                  )}
                  <span className="text-xs text-gray-400">{annotation.author?.name || 'Unknown User'}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
