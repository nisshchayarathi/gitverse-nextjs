import { useState } from 'react';
import { Card } from '@/components/ui';
import { Filter, X, Check } from 'lucide-react';
import { GraphFilters } from '@/hooks/useGraphFilters';

interface FilterPanelProps {
  filters: GraphFilters;
  toggleDirectory: (dir: string) => void;
  toggleFileType: (ext: string) => void;
  toggleDomain: (domain: string) => void;
  resetFilters: () => void;
}

const COMMON_DIRS = ['node_modules', 'dist', 'build', '.git', '.next', 'vendor', 'coverage', 'tests'];
const COMMON_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.md', '.json'];
const COMMON_DOMAINS = ['frontend', 'backend', 'api', 'services', 'auth', 'shared', 'infrastructure'];

export function FilterPanel({ filters, toggleDirectory, toggleFileType, toggleDomain, resetFilters }: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="absolute top-4 right-4 bg-slate-800 text-slate-200 p-2 rounded-full shadow-lg hover:bg-slate-700 transition z-10"
        title="Advanced Filters"
      >
        <Filter size={20} />
      </button>
    );
  }

  return (
    <Card className="absolute top-4 right-4 w-80 max-h-[80vh] overflow-y-auto bg-slate-900 border-slate-700 shadow-2xl z-10 p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-slate-100 flex items-center gap-2">
          <Filter size={16} /> Advanced Filters
        </h3>
        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Hidden Directories</h4>
          <div className="flex flex-wrap gap-2">
            {COMMON_DIRS.map(dir => {
              const isHidden = filters.hiddenDirectories.includes(dir);
              return (
                <button
                  key={dir}
                  onClick={() => toggleDirectory(dir)}
                  className={`text-xs px-2 py-1 rounded-md border ${isHidden ? 'bg-red-900/30 border-red-800 text-red-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
                >
                  {dir} {isHidden && <Check size={12} className="inline ml-1" />}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Hidden File Types</h4>
          <div className="flex flex-wrap gap-2">
            {COMMON_EXTS.map(ext => {
              const isHidden = filters.hiddenFileTypes.includes(ext);
              return (
                <button
                  key={ext}
                  onClick={() => toggleFileType(ext)}
                  className={`text-xs px-2 py-1 rounded-md border ${isHidden ? 'bg-red-900/30 border-red-800 text-red-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
                >
                  {ext} {isHidden && <Check size={12} className="inline ml-1" />}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Domain Isolation (Show Only)</h4>
          <div className="flex flex-wrap gap-2">
            {COMMON_DOMAINS.map(domain => {
              const isVisible = filters.visibleDomains.includes(domain);
              return (
                <button
                  key={domain}
                  onClick={() => toggleDomain(domain)}
                  className={`text-xs px-2 py-1 rounded-md border ${isVisible ? 'bg-indigo-900/50 border-indigo-500 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
                >
                  {domain} {isVisible && <Check size={12} className="inline ml-1" />}
                </button>
              );
            })}
          </div>
        </div>

        <button 
          onClick={resetFilters}
          className="w-full py-2 text-sm text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded transition"
        >
          Reset to Defaults
        </button>
      </div>
    </Card>
  );
}
