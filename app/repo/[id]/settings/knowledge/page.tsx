"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Knowledge {
  projectDescription?: string;
  glossary?: Record<string, string>;
  onboardingNotes?: string[];
  architecturePrinciples?: string[];
  updatedAt?: string;
}

export default function RepositoryKnowledgeSettings() {
  const params = useParams();
  const repositoryId = params?.id as string;
  const [knowledge, setKnowledge] = useState<Knowledge | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKnowledge = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/repositories/${repositoryId}/knowledge`);
      if (!response.ok) {
        throw new Error("Failed to fetch knowledge");
      }
      const data = await response.json();
      setKnowledge(data.knowledge);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const response = await fetch(`/api/repositories/${repositoryId}/knowledge/refresh`, {
        method: "POST"
      });
      if (!response.ok) {
        throw new Error("Failed to refresh knowledge");
      }
      const data = await response.json();
      setKnowledge(data.knowledge);
    } catch (err: any) {
      setError(err.message || "An error occurred while refreshing");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (repositoryId) {
      fetchKnowledge();
    }
  }, [repositoryId]);

  if (loading) {
    return <div className="p-6">Loading repository knowledge...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Repository Knowledge Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Maintainer-defined context and AI onboarding glossaries injected into AI interactions.</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {refreshing ? "Refreshing..." : "Refresh Knowledge"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded mb-6 border border-red-200">
          {error}
        </div>
      )}

      {!knowledge || Object.keys(knowledge).filter(k => k !== 'updatedAt').length === 0 ? (
        <div className="bg-white dark:bg-gray-800 p-8 text-center rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No custom knowledge configured</h3>
          <p className="text-gray-500 max-w-lg mx-auto">
            To provide custom context to the AI, add a <code className="bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">.gitverse.md</code> or <code className="bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">.gitverse.json</code> file to the root of your repository and refresh this page.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="text-xs text-gray-400 text-right">
            Last updated: {knowledge.updatedAt ? new Date(knowledge.updatedAt).toLocaleString() : 'Unknown'}
          </div>

          {knowledge.projectDescription && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Project Description</h2>
              <p className="text-gray-700 dark:text-gray-300">{knowledge.projectDescription}</p>
            </div>
          )}

          {knowledge.architecturePrinciples && knowledge.architecturePrinciples.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Architecture Principles</h2>
              <ul className="list-disc pl-5 space-y-2 text-gray-700 dark:text-gray-300">
                {knowledge.architecturePrinciples.map((principle, idx) => (
                  <li key={idx}>{principle}</li>
                ))}
              </ul>
            </div>
          )}

          {knowledge.glossary && Object.keys(knowledge.glossary).length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Custom Glossary</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(knowledge.glossary).map(([term, definition]) => (
                  <div key={term} className="bg-gray-50 dark:bg-gray-900 p-4 rounded border border-gray-100 dark:border-gray-700">
                    <span className="font-semibold text-gray-900 dark:text-white block mb-1">{term}</span>
                    <span className="text-gray-600 dark:text-gray-400 text-sm">{definition}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {knowledge.onboardingNotes && knowledge.onboardingNotes.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Contributor Onboarding</h2>
              <ul className="list-disc pl-5 space-y-2 text-gray-700 dark:text-gray-300">
                {knowledge.onboardingNotes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
