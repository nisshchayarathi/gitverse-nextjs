import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Clock } from 'lucide-react';

interface Commit {
  hash: string;
  shortHash: string;
  message: string;
  timestamp: string;
  authorName?: string;
}

interface TimeTravelTimelineProps {
  commits: Commit[];
  selectedCommitHash: string | null;
  onCommitSelect: (hash: string | null) => void;
}

export const TimeTravelTimeline: React.FC<TimeTravelTimelineProps> = ({
  commits,
  selectedCommitHash,
  onCommitSelect,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Commits are typically newest-first. We want the slider left-to-right (oldest-to-newest).
  // So index 0 = oldest, commits.length - 1 = newest.
  const chronologicalCommits = useMemo(() => {
    return [...commits].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [commits]);

  const currentIndex = useMemo(() => {
    if (!selectedCommitHash) return chronologicalCommits.length - 1;
    const idx = chronologicalCommits.findIndex((c) => c.hash === selectedCommitHash);
    return idx >= 0 ? idx : chronologicalCommits.length - 1;
  }, [selectedCommitHash, chronologicalCommits]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIndex = parseInt(e.target.value, 10);
    if (newIndex >= 0 && newIndex < chronologicalCommits.length) {
      // If at the very end, treat as "current" state (null selected)
      if (newIndex === chronologicalCommits.length - 1) {
        onCommitSelect(null);
      } else {
        onCommitSelect(chronologicalCommits[newIndex].hash);
      }
    }
  };

  const togglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        let nextIndex = currentIndex + 1;
        if (nextIndex >= chronologicalCommits.length) {
          nextIndex = 0; // loop back to start or pause? Let's just pause
          setIsPlaying(false);
          return;
        }
        if (nextIndex === chronologicalCommits.length - 1) {
          onCommitSelect(null);
        } else {
          onCommitSelect(chronologicalCommits[nextIndex].hash);
        }
      }, 1000); // 1 second per step
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying, currentIndex, chronologicalCommits, onCommitSelect]);

  if (chronologicalCommits.length === 0) return null;

  const currentCommit = chronologicalCommits[currentIndex];
  const isLatest = currentIndex === chronologicalCommits.length - 1;

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="glass rounded-xl p-4 mt-6 animate-fade-in-up border border-primary/20 bg-black/40 backdrop-blur-md relative overflow-hidden">
      {/* Decorative gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none" />
      
      <div className="flex flex-col sm:flex-row items-center gap-4 relative z-10">
        
        {/* Controls */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => onCommitSelect(chronologicalCommits[0].hash)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-muted-foreground hover:text-white"
            title="Go to oldest"
          >
            <SkipBack className="h-4 w-4" />
          </button>
          <button 
            onClick={togglePlay}
            className="p-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
            title={isPlaying ? "Pause" : "Play history"}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>
          <button 
            onClick={() => onCommitSelect(null)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-muted-foreground hover:text-white"
            title="Go to latest"
          >
            <SkipForward className="h-4 w-4" />
          </button>
        </div>

        {/* Slider & Info */}
        <div className="flex-1 w-full space-y-2">
          <div className="flex justify-between items-end mb-1">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-white">
                {isLatest ? "Current State" : "Historical State"}
              </span>
            </div>
            {currentCommit && (
              <div className="text-right">
                <div className="text-xs font-mono text-muted-foreground">
                  {currentCommit.shortHash} • {formatDate(currentCommit.timestamp)}
                </div>
              </div>
            )}
          </div>
          
          <input 
            type="range" 
            min={0} 
            max={chronologicalCommits.length - 1} 
            value={currentIndex}
            onChange={handleSliderChange}
            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary hover:accent-primary/80 transition-all"
          />
          
          {currentCommit && (
            <div className="text-xs text-muted-foreground truncate max-w-xl">
              <span className="font-medium text-white/80">{currentCommit.authorName || 'Unknown'}:</span> {currentCommit.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
