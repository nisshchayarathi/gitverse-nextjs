"use client";

import React from "react";
import { Card } from "../ui/Card";

interface Repository {
  id: number;
  name: string;
  isInherited: boolean;
}

interface RepositoryAssignmentsProps {
  repositories: Repository[];
  isLocked: boolean;
}

export function RepositoryAssignments({ repositories, isLocked }: RepositoryAssignmentsProps) {
  return (
    <Card className="p-6 bg-slate-900/50 backdrop-blur-md border border-slate-800">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-white">Repository Assignments</h3>
        {isLocked && (
          <span className="px-3 py-1 bg-amber-500/20 text-amber-400 text-sm font-medium rounded-full border border-amber-500/30">
            Policies Locked Globally
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="p-3 text-sm font-medium text-slate-400">Repository Name</th>
              <th className="p-3 text-sm font-medium text-slate-400">Policy Source</th>
              <th className="p-3 text-sm font-medium text-slate-400">Status</th>
            </tr>
          </thead>
          <tbody>
            {repositories.map(repo => (
              <tr key={repo.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                <td className="p-3 text-slate-200 font-medium">{repo.name}</td>
                <td className="p-3">
                  {repo.isInherited ? (
                    <span className="text-blue-400 text-sm">Inheriting from Org</span>
                  ) : (
                    <span className="text-slate-400 text-sm">Custom (Repository Level)</span>
                  )}
                </td>
                <td className="p-3">
                  {isLocked && !repo.isInherited ? (
                    <span className="text-amber-400 text-sm">Override Ignored (Locked)</span>
                  ) : (
                    <span className="text-emerald-400 text-sm">Active</span>
                  )}
                </td>
              </tr>
            ))}
            {repositories.length === 0 && (
              <tr>
                <td colSpan={3} className="p-4 text-center text-slate-500">
                  No repositories assigned to this organization.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
