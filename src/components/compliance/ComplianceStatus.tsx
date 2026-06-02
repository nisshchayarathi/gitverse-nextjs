import React from 'react';

export default function ComplianceStatus() {
  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Compliance Status</h2>
      
      <div className="flex items-center mb-4">
        <div className="flex-shrink-0">
          <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="ml-4">
          <h3 className="text-md font-bold text-gray-900 dark:text-white">Compliant</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">All data residency rules enforced</p>
        </div>
      </div>

      <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-4">
          <div>
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Readiness</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white font-medium">GDPR Ready</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Policy</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white font-medium">Strict Isolation</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
