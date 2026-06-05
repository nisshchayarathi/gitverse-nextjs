import React from 'react';
import RegionSelector from '@/components/compliance/RegionSelector';
import ComplianceStatus from '@/components/compliance/ComplianceStatus';
import AuditLogViewer from '@/components/compliance/AuditLogViewer';

export default function ComplianceSettingsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Enterprise Compliance</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Manage your organization&apos;s data residency, compliance routing, and audit logs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-8">
          <ComplianceStatus />
          <RegionSelector />
        </div>
        
        <div className="lg:col-span-2">
          <AuditLogViewer />
        </div>
      </div>
    </div>
  );
}
