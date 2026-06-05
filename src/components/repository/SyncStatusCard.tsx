"use client";

import React, { useEffect, useState } from "react";

type SyncJob = {
  id: string;
  eventType: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
};

type SyncStatusCardProps = {
  repositoryId: string;
  initialJobs?: SyncJob[];
  lastSynchronizedAt?: string | null;
};

export const SyncStatusCard: React.FC<SyncStatusCardProps> = ({ repositoryId, initialJobs = [], lastSynchronizedAt }) => {
  const [jobs, setJobs] = useState<SyncJob[]>(initialJobs);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Repository Synchronization</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Last synchronized: {lastSynchronizedAt ? new Date(lastSynchronizedAt).toLocaleString() : "Never"}
      </p>

      {jobs.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Recent Sync Jobs</h4>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {jobs.slice(0, 5).map((job) => (
              <li key={job.id} className="py-2 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{job.eventType}</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {job.startedAt ? new Date(job.startedAt).toLocaleString() : "Queued"}
                  </p>
                </div>
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  job.status === "COMPLETED" ? "bg-green-100 text-green-800" :
                  job.status === "FAILED" ? "bg-red-100 text-red-800" :
                  "bg-yellow-100 text-yellow-800"
                }`}>
                  {job.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-gray-500 italic">No recent sync events.</p>
      )}
    </div>
  );
};
