'use client';

import { useState } from 'react';

interface SyncButtonProps {
  repositoryId: number;
  initialSyncedAt: Date | string | null;
}

export default function SyncButton({ repositoryId, initialSyncedAt }: SyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
    initialSyncedAt ? new Date(initialSyncedAt).toISOString() : null
  );
  const [error, setError] = useState('');

  const handleSync = async () => {
    setIsSyncing(true);
    setError('');

    try {
      const res = await fetch(`/api/repositories/${repositoryId}/sync`, {
        method: 'POST',
      });

      // FIX: Check for errors BEFORE trying to parse JSON
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error('Rate limit reached. Please wait a minute.');
        }
        
        // Safely check if the error response is JSON before parsing
        const isJson = res.headers.get('content-type')?.includes('application/json');
        if (isJson) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to sync');
        }
        
        throw new Error(`Failed to sync: ${res.statusText}`);
      }

      // If we get here, the response is definitely a 200 OK
      const data = await res.json();
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Format the timestamp cleanly (e.g., "Oct 24, 2:30 PM")
  const formattedDate = lastSyncedAt
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      }).format(new Date(lastSyncedAt))
    : 'Never';

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-500">
        Last synced: <strong className="text-slate-700">{formattedDate}</strong>
      </span>
      <button
        onClick={handleSync}
        disabled={isSyncing}
        className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSyncing ? 'Syncing...' : '↻ Refresh'}
      </button>
      {error && <span className="text-sm font-medium text-red-500">{error}</span>}
    </div>
  );
}