"use client";

import React from "react";
import { Card } from "../ui/Card";

interface PolicyStatusCardProps {
  governedRepos: number;
  recentViolations: number;
  blockedMerges: number;
}

export function PolicyStatusCard({ governedRepos, recentViolations, blockedMerges }: PolicyStatusCardProps) {
  return (
    <Card className="p-6 bg-slate-900/50 backdrop-blur-md border border-slate-800">
      <h3 className="text-xl font-semibold text-white mb-4">Organization Security Overview</h3>
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-slate-800/50 rounded-lg">
          <p className="text-sm text-slate-400">Governed Repositories</p>
          <p className="text-3xl font-bold text-blue-400">{governedRepos}</p>
        </div>
        <div className="p-4 bg-slate-800/50 rounded-lg">
          <p className="text-sm text-slate-400">Recent Violations</p>
          <p className="text-3xl font-bold text-amber-400">{recentViolations}</p>
        </div>
        <div className="p-4 bg-slate-800/50 rounded-lg">
          <p className="text-sm text-slate-400">Blocked Merges</p>
          <p className="text-3xl font-bold text-rose-400">{blockedMerges}</p>
        </div>
      </div>
    </Card>
  );
}
