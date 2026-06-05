"use client";

import React, { useState } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

interface PolicyManagerProps {
  initialPolicies: {
    enforceSecurityReviews: boolean;
    enforceSecretScanning: boolean;
    blockCriticalSecrets: boolean;
    blackoutWindowsEnabled: boolean;
    policyLockEnabled: boolean;
  };
  onSave: (policies: any) => Promise<void>;
}

export function PolicyManager({ initialPolicies, onSave }: PolicyManagerProps) {
  const [policies, setPolicies] = useState(initialPolicies);
  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = (key: keyof typeof policies) => {
    setPolicies(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(policies);
    setIsSaving(false);
  };

  return (
    <Card className="p-6 bg-slate-900/50 backdrop-blur-md border border-slate-800">
      <h3 className="text-xl font-semibold text-white mb-6">Organization Policies</h3>
      
      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
          <div>
            <h4 className="font-medium text-slate-200">Mandatory AI Security Review</h4>
            <p className="text-sm text-slate-400">Require all PRs to pass an AI security review before merging.</p>
          </div>
          <button
            onClick={() => handleToggle("enforceSecurityReviews")}
            className={`w-12 h-6 rounded-full transition-colors ${policies.enforceSecurityReviews ? 'bg-blue-500' : 'bg-slate-600'} relative`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${policies.enforceSecurityReviews ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
          <div>
            <h4 className="font-medium text-slate-200">Enforce Secret Scanning</h4>
            <p className="text-sm text-slate-400">Automatically scan for exposed secrets on all commits.</p>
          </div>
          <button
            onClick={() => handleToggle("enforceSecretScanning")}
            className={`w-12 h-6 rounded-full transition-colors ${policies.enforceSecretScanning ? 'bg-blue-500' : 'bg-slate-600'} relative`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${policies.enforceSecretScanning ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
          <div>
            <h4 className="font-medium text-slate-200">Block Critical Secrets</h4>
            <p className="text-sm text-slate-400">Prevent merging if high-severity secrets (like AWS keys) are detected.</p>
          </div>
          <button
            onClick={() => handleToggle("blockCriticalSecrets")}
            className={`w-12 h-6 rounded-full transition-colors ${policies.blockCriticalSecrets ? 'bg-blue-500' : 'bg-slate-600'} relative`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${policies.blockCriticalSecrets ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between p-4 bg-amber-900/20 rounded-lg border border-amber-500/30">
          <div>
            <h4 className="font-medium text-amber-200">Policy Lock (Enforce Globally)</h4>
            <p className="text-sm text-amber-400/80">If enabled, repository maintainers cannot override or weaken these policies.</p>
          </div>
          <button
            onClick={() => handleToggle("policyLockEnabled")}
            className={`w-12 h-6 rounded-full transition-colors ${policies.policyLockEnabled ? 'bg-amber-500' : 'bg-slate-600'} relative`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${policies.policyLockEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Policies"}
        </Button>
      </div>
    </Card>
  );
}
