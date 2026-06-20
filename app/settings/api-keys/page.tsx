"use client";

import { useCallback, useEffect, useState } from "react";
import { Key, Plus, Trash2, Copy, Check } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  Button,
  Input,
} from "@/components/ui";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

type ApiKeyEntry = {
  id: number;
  name: string;
  scopes: string[];
  expiresAt: string;
  lastUsedAt: string | null;
  createdAt: string;
};

export default function ApiKeysSettingsPage() {
  const [keys, setKeys] = useState<ApiKeyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/api-keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys);
      }
    } catch {
      toast.error("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to create key");
        return;
      }
      const data = await res.json();
      setNewlyCreatedKey(data.key);
      setNewKeyName("");
      setShowCreate(false);
      await fetchKeys();
    } catch {
      toast.error("Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: number, name: string) => {
    if (!confirm(`Revoke API key "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/settings/api-keys/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("API key revoked");
        await fetchKeys();
      } else {
        toast.error("Failed to revoke key");
      }
    } catch {
      toast.error("Failed to revoke key");
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">API Keys</h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Manage personal access tokens for CI/CD and external integrations
              </p>
            </div>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Key
            </Button>
          </div>

          {newlyCreatedKey && (
            <Card className="mb-6 border-green-200 dark:border-green-800">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      API key created successfully
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      Save this key now — you won&apos;t be able to see it again
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono break-all">
                        {newlyCreatedKey}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(newlyCreatedKey)}
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <button
                    onClick={() => setNewlyCreatedKey(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    &times;
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          {showCreate && (
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Key name
                    </label>
                    <Input
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g. CI/CD Pipeline"
                      onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    />
                  </div>
                  <Button onClick={handleCreate} disabled={creating || !newKeyName.trim()}>
                    {creating ? "Creating..." : "Create"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : keys.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Key className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No API keys
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Create a key to use GitVerse with CI/CD pipelines or external tools
                </p>
                <Button onClick={() => setShowCreate(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create your first key
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => (
                <Card key={key.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {key.name}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <span>Created {new Date(key.createdAt).toLocaleDateString()}</span>
                        <span>
                          {key.lastUsedAt
                            ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                            : "Never used"}
                        </span>
                        <span>Expires {new Date(key.expiresAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-500 hover:text-red-700 border-red-200 hover:border-red-300"
                      onClick={() => handleRevoke(key.id, key.name)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Revoke
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
