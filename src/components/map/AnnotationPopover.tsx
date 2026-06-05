import React, { useState } from 'react';
import { MapAnnotation } from '@/services/annotationService';
import { X, Check } from 'lucide-react';

interface AnnotationPopoverProps {
  x: number;
  y: number;
  initialData?: Partial<MapAnnotation>;
  onSave: (data: Partial<MapAnnotation>) => void;
  onCancel: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
}

export const AnnotationPopover: React.FC<AnnotationPopoverProps> = ({ x, y, initialData, onSave, onCancel, onDelete, canEdit = true }) => {
  const [content, setContent] = useState(initialData?.content || '');
  const [type, setType] = useState<MapAnnotation['annotationType']>(initialData?.annotationType || 'comment');

  return (
    <div 
      className="absolute bg-[#1e293b] border border-white/10 rounded-lg shadow-2xl p-4 w-72 z-20 text-white"
      style={{ left: x, top: y, transform: 'translate(-50%, -100%)', marginTop: '-12px' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-semibold text-sm">
          {initialData?.id ? 'Edit Annotation' : 'New Annotation'}
        </h4>
        <button onClick={onCancel} className="text-gray-400 hover:text-white">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-3">
        <select 
          value={type}
          onChange={(e) => setType(e.target.value as any)}
          disabled={!canEdit}
          className="w-full bg-[#0f172a] border border-white/10 rounded px-2 py-1.5 text-sm outline-none focus:border-primary"
        >
          <option value="comment">💬 Comment</option>
          <option value="warning">⚠️ Warning</option>
          <option value="technical-debt">🐛 Technical Debt</option>
          <option value="refactor">🔧 Refactor</option>
          <option value="documentation">📄 Documentation</option>
          <option value="issue-link">🔗 Issue Link</option>
        </select>

        <textarea 
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter annotation content (Markdown supported)"
          disabled={!canEdit}
          className="w-full h-24 bg-[#0f172a] border border-white/10 rounded p-2 text-sm outline-none focus:border-primary resize-none"
        />

        {canEdit && (
          <div className="flex justify-between items-center pt-2">
            {onDelete ? (
              <button 
                onClick={onDelete}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
              >
                Delete
              </button>
            ) : <div />}
            <button 
              onClick={() => onSave({ content, annotationType: type })}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1"
              disabled={!content.trim()}
            >
              <Check size={14} />
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
