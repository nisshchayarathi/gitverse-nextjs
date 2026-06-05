import React from 'react';
import { MapAnnotation } from '@/services/annotationService';
import { MessageSquare, AlertTriangle, Bug, Wrench, FileText, Link } from 'lucide-react';

interface AnnotationMarkerProps {
  annotation: MapAnnotation;
  x: number;
  y: number;
  onClick: () => void;
}

const typeIcons = {
  'comment': MessageSquare,
  'warning': AlertTriangle,
  'technical-debt': Bug,
  'refactor': Wrench,
  'documentation': FileText,
  'issue-link': Link,
};

const typeColors = {
  'comment': 'bg-blue-500',
  'warning': 'bg-amber-500',
  'technical-debt': 'bg-red-500',
  'refactor': 'bg-purple-500',
  'documentation': 'bg-emerald-500',
  'issue-link': 'bg-indigo-500',
};

export const AnnotationMarker: React.FC<AnnotationMarkerProps> = ({ annotation, x, y, onClick }) => {
  const Icon = typeIcons[annotation.annotationType] || MessageSquare;
  const bgColor = typeColors[annotation.annotationType] || 'bg-blue-500';

  return (
    <div 
      className={`absolute w-6 h-6 rounded-full flex items-center justify-center text-white cursor-pointer shadow-lg transform -translate-x-1/2 -translate-y-1/2 hover:scale-125 transition-transform ${bgColor} z-10`}
      style={{ left: x, top: y }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title="Click to view annotation"
    >
      <Icon size={12} />
    </div>
  );
};
