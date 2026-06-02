"use client";

import React, { useState } from 'react';
import { toast } from "@/hooks/use-toast";

export default function RegionSelector() {
  const [region, setRegion] = useState("US");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = () => {
    setIsUpdating(true);
    // Mock update API call
    setTimeout(() => {
      setIsUpdating(false);
      toast({
        title: "Region updated",
        description: `Data residency region set to ${region}.`,
      });
    }, 1000);
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Data Residency Region</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Select the primary region for storing your repository data, AI embeddings, and metadata.
      </p>

      <div className="space-y-4">
        {['US', 'EU', 'APAC'].map((r) => (
          <label key={r} className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600">
            <input
              type="radio"
              name="region"
              value={r}
              checked={region === r}
              onChange={(e) => setRegion(e.target.value)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <span className="ml-3 font-medium text-gray-900 dark:text-white">
              {r === 'US' ? 'United States (US)' : r === 'EU' ? 'Europe (EU)' : 'Asia Pacific (APAC)'}
            </span>
          </label>
        ))}
      </div>

      <button
        onClick={handleUpdate}
        disabled={isUpdating}
        className="mt-6 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {isUpdating ? 'Updating...' : 'Save Region Configuration'}
      </button>
    </div>
  );
}
