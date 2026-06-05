import { IncidentPayload } from "@/types/incident-response";

export class IncidentIngestionService {
  /**
   * Processes an incoming webhook payload from various sources
   * and normalizes it into a standard IncidentPayload.
   */
  public processWebhook(
    source: "sentry" | "datadog" | "pagerduty" | "generic",
    payload: any
  ): IncidentPayload {
    console.log(`[IncidentIngestion] Received webhook from source: ${source}`);

    switch (source) {
      case "sentry":
        return this.parseSentry(payload);
      case "datadog":
        return this.parseDatadog(payload);
      case "pagerduty":
        return this.parsePagerduty(payload);
      case "generic":
      default:
        return this.parseGeneric(payload);
    }
  }

  private parseSentry(payload: any): IncidentPayload {
    return {
      id: payload.id || `sentry-${Date.now()}`,
      title: payload.event?.title || payload.project_name || "Sentry Incident",
      severity: this.mapSeverity(payload.level),
      stackTrace: payload.event?.exception?.values?.[0]?.stacktrace?.frames
        ?.map((f: any) => `${f.filename}:${f.lineno} ${f.function}`)
        .join("\n"),
      affectedService: payload.project_name,
      timestamp: payload.event?.timestamp
        ? new Date(payload.event.timestamp * 1000).toISOString()
        : new Date().toISOString(),
      environment: payload.event?.environment || "production",
      source: "sentry",
      metadata: payload,
    };
  }

  private parseDatadog(payload: any): IncidentPayload {
    return {
      id: payload.id || `dd-${Date.now()}`,
      title: payload.title || "Datadog Monitor Alert",
      severity: this.mapSeverity(payload.priority || "normal"),
      affectedService: payload.tags?.find((t: string) => t.startsWith("service:"))?.split(":")[1],
      timestamp: new Date().toISOString(), // Fallback if timestamp not easily available
      environment: payload.tags?.find((t: string) => t.startsWith("env:"))?.split(":")[1] || "production",
      source: "datadog",
      metadata: payload,
    };
  }

  private parsePagerduty(payload: any): IncidentPayload {
    const incident = payload.messages?.[0]?.incident;
    return {
      id: incident?.id || `pd-${Date.now()}`,
      title: incident?.title || "PagerDuty Incident",
      severity: this.mapSeverity(incident?.urgency),
      affectedService: incident?.service?.summary,
      timestamp: incident?.created_at || new Date().toISOString(),
      environment: "production", // PD often doesn't specify env strictly in the webhook root
      source: "pagerduty",
      metadata: payload,
    };
  }

  private parseGeneric(payload: any): IncidentPayload {
    return {
      id: payload.id || `generic-${Date.now()}`,
      title: payload.title || "Production Incident",
      severity: this.mapSeverity(payload.severity),
      stackTrace: payload.stackTrace,
      affectedService: payload.service,
      timestamp: payload.timestamp || new Date().toISOString(),
      environment: payload.environment || "production",
      source: "generic",
      metadata: payload,
    };
  }

  private mapSeverity(level: string): "critical" | "high" | "medium" | "low" {
    if (!level) return "medium";
    const lowerLevel = level.toLowerCase();
    
    if (["fatal", "critical", "p1", "high"].includes(lowerLevel)) return "critical";
    if (["error", "p2"].includes(lowerLevel)) return "high";
    if (["warning", "p3", "medium"].includes(lowerLevel)) return "medium";
    return "low";
  }
}

let ingestionServiceSingleton: IncidentIngestionService | null = null;

export function getIncidentIngestionService(): IncidentIngestionService {
  if (!ingestionServiceSingleton) {
    ingestionServiceSingleton = new IncidentIngestionService();
  }
  return ingestionServiceSingleton;
}
