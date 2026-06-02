"use client";

import React, { useState, useEffect } from 'react';

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  details: any;
  createdAt: string;
}

export default function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mocking an API call to fetch audit logs
    setTimeout(() => {
      setLogs([
        {
          id: '1',
          action: 'REGION_CHANGE',
          resource: 'Organization.dataResidencyRegion',
          details: { oldRegion: 'US', newRegion: 'EU' },
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: '2',
          action: 'COMPLIANCE_VIOLATION',
          resource: 'Repository.AI_Analysis',
          details: { reason: 'Attempted US processing on EU repository' },
          createdAt: new Date(Date.now() - 86400000).toISOString(),
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Compliance Audit Log</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
          Track region changes, policy updates, and violations.
        </p>
      </div>
      
      {loading ? (
        <div className="p-6 text-center text-sm text-gray-500">Loading audit logs...</div>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {logs.map((log) => (
            <li key={log.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-750">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    log.action === 'COMPLIANCE_VIOLATION' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {log.action}
                  </span>
                  <p className="ml-3 text-sm font-medium text-gray-900 dark:text-white truncate">
                    {log.resource}
                  </p>
                </div>
                <div className="ml-2 flex-shrink-0 flex">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="mt-2 sm:flex sm:justify-between">
                <div className="sm:flex">
                  <p className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    {JSON.stringify(log.details)}
                  </p>
                </div>
              </div>
            </li>
          ))}
          {logs.length === 0 && (
            <li className="p-6 text-center text-sm text-gray-500">No audit logs found.</li>
          )}
        </ul>
      )}
    </div>
  );
}
