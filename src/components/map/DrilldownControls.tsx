import { ArrowLeft, Target, RefreshCw } from 'lucide-react';

interface DrilldownControlsProps {
  canGoBack: boolean;
  onGoBack: () => void;
  onClearFocus: () => void;
  focusNode: string | null;
  onResetGraph: () => void;
}

export function DrilldownControls({ canGoBack, onGoBack, onClearFocus, focusNode, onResetGraph }: DrilldownControlsProps) {
  return (
    <div className="absolute top-4 left-4 z-10 flex gap-2">
      {canGoBack && (
        <button
          onClick={onGoBack}
          className="bg-slate-800 text-slate-200 px-3 py-2 rounded-lg shadow-lg hover:bg-slate-700 transition flex items-center gap-2 text-sm border border-slate-700"
        >
          <ArrowLeft size={16} /> Back
        </button>
      )}
      
      {focusNode && (
        <div className="bg-indigo-900/40 border border-indigo-500/50 text-indigo-200 px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm backdrop-blur-sm">
          <Target size={16} className="text-indigo-400" />
          Focus: <span className="font-mono text-xs">{focusNode.replace(/^(folder|file)-/, '')}</span>
          <button onClick={onClearFocus} className="ml-2 text-indigo-400 hover:text-indigo-200">
            &times;
          </button>
        </div>
      )}

      <button
        onClick={onResetGraph}
        className="bg-slate-800 text-slate-200 p-2 rounded-lg shadow-lg hover:bg-slate-700 transition border border-slate-700"
        title="Reset Drilldown View"
      >
        <RefreshCw size={16} />
      </button>
    </div>
  );
}
