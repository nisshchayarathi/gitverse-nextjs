"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, RotateCcw, ChevronDown, ChevronRight, Search, AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Card, CardContent } from "@/components/ui";

type WebhookEvent = {
  id: string;
  event: string;
  action: string | null;
  status: string;
  error: string | null;
  deliveryId: string | null;
  payload?: any;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUS_ICONS: Record<string, { icon: typeof AlertCircle; color: string }> = {
  pending: { icon: Clock, color: "text-yellow-500" },
  processing: { icon: RefreshCw, color: "text-blue-500" },
  completed: { icon: CheckCircle, color: "text-green-500" },
  failed: { icon: XCircle, color: "text-red-500" },
  dlq: { icon: AlertCircle, color: "text-red-700" },
  rate_limited: { icon: AlertCircle, color: "text-orange-500" },
};

export default function WebhookInspectorPage() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [skip, setSkip] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [idFilter, setIdFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replaying, setReplaying] = useState<string | null>(null);
  const [replayingAll, setReplayingAll] = useState(false);

  const take = 50;

  const fetchEvents = useCallback(async (append = false, nextSkip?: number) => {
    setLoading(true);
    try {
      const offset = append ? (nextSkip ?? skip) : 0;
      const params = new URLSearchParams({ take: String(take), skip: String(offset) });
      if (statusFilter) params.set("status", statusFilter);
      if (eventFilter) params.set("event", eventFilter);
      if (idFilter) params.set("id", idFilter);

      const res = await fetch(`/api/admin/webhooks?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setEvents(append ? (prev) => [...prev, ...data.events] : data.events);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load webhook events");
    } finally {
      setLoading(false);
    }
  }, [skip, statusFilter, eventFilter, idFilter]);

  useEffect(() => {
    setSkip(0);
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, eventFilter, idFilter]);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    const event = events.find((e) => e.id === id);
    if (!event?.payload) {
      try {
        const res = await fetch(`/api/admin/webhooks?payload=true&id=${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.events.length > 0) {
            setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, payload: data.events[0].payload } : e)));
          }
        }
      } catch {}
    }
  };

  const handleReplay = async (id: string) => {
    setReplaying(id);
    try {
      const res = await fetch(`/api/admin/webhooks/${id}/replay`, { method: "POST" });
      if (res.ok) {
        toast.success("Event re-queued for processing");
        setEvents((prev) =>
          prev.map((e) => (e.id === id ? { ...e, status: "pending", error: null, retryCount: 0 } : e)),
        );
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to replay");
      }
    } catch {
      toast.error("Failed to replay event");
    } finally {
      setReplaying(null);
    }
  };

  const handleReplayAll = async () => {
    if (!confirm("Re-queue all failed and DLQ events for processing?")) return;
    setReplayingAll(true);
    try {
      const res = await fetch("/api/admin/webhooks/replay-failed", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.replayed} events re-queued`);
        fetchEvents();
      } else {
        toast.error("Failed to replay events");
      }
    } catch {
      toast.error("Failed to replay events");
    } finally {
      setReplayingAll(false);
    }
  };

  const StatusIcon = ({ status }: { status: string }) => {
    const config = STATUS_ICONS[status] || STATUS_ICONS.failed;
    const Icon = config.icon;
    return <Icon className={`w-4 h-4 ${config.color}`} />;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Webhook Inspector</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {total} events total — inspect, filter, and replay failed webhook deliveries
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => fetchEvents()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleReplayAll} disabled={replayingAll}>
            <RotateCcw className="w-4 h-4 mr-2" />
            {replayingAll ? "Replaying..." : "Replay All Failed"}
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="dlq">DLQ</option>
                <option value="rate_limited">Rate Limited</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Event type</label>
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              >
                <option value="">All events</option>
                <option value="pull_request">pull_request</option>
                <option value="issues">issues</option>
                <option value="push">push</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Event ID</label>
              <Input
                value={idFilter}
                onChange={(e) => setIdFilter(e.target.value)}
                placeholder="Filter by event ID"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && events.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Search className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No events found</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Try adjusting your filters
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {events.map((event) => {
            const isExpanded = expandedId === event.id;
            const canReplay = ["failed", "dlq", "rate_limited"].includes(event.status);
            return (
              <Card key={event.id}>
                <CardContent className="p-0">
                  <button
                    onClick={() => toggleExpand(event.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    )}
                    <StatusIcon status={event.status} />
                    <span className="text-xs font-mono text-gray-400 w-28 truncate">{event.id}</span>
                    <span className="text-sm font-medium w-28">{event.event}</span>
                    <span className="text-sm text-gray-500 w-20">{event.action || "-"}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-24 text-center ${
                      event.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : event.status === "failed" || event.status === "dlq" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                      : event.status === "rate_limited" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                      : event.status === "processing" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                    }`}>
                      {event.status}
                    </span>
                    {event.deliveryId && (
                      <span className="text-xs text-gray-400 font-mono truncate flex-1 hidden lg:block">
                        {event.deliveryId}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 w-32 text-right shrink-0">
                      {new Date(event.createdAt).toLocaleString()}
                    </span>
                    {canReplay && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); handleReplay(event.id); }}
                        disabled={replaying === event.id}
                        className="shrink-0"
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        {replaying === event.id ? "..." : "Replay"}
                      </Button>
                    )}
                  </button>
                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 space-y-3">
                      {event.error && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Error</p>
                          <pre className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded overflow-x-auto">
                            {event.error}
                          </pre>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Payload</p>
                        <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded overflow-x-auto max-h-60 overflow-y-auto">
                          {event.payload
                            ? JSON.stringify(event.payload, null, 2)
                            : "Loading..."}
                        </pre>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>Retries: {event.retryCount}/{event.maxRetries}</span>
                        {event.nextRetryAt && (
                          <span>Next retry: {new Date(event.nextRetryAt).toLocaleString()}</span>
                        )}
                        <span>Updated: {new Date(event.updatedAt).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {events.length < total && (
            <div className="text-center pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  const next = skip + take;
                  setSkip(next);
                  fetchEvents(true, next);
                }}
              >
                Load more ({events.length} of {total})
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
