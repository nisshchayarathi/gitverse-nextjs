import { NextRequest, NextResponse } from "next/server";
import { getIncidentIngestionService } from "@/lib/services/incident-ingestion";
import { getDeploymentAnalysisService } from "@/lib/services/deployment-analysis";
import { getIncidentCorrelationService } from "@/lib/services/incident-correlation";
import { getRollbackPrService } from "@/lib/services/rollback-pr";
import { IncidentReport } from "@/types/incident-response";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    
    // In a real scenario, we'd determine source via headers (e.g., x-sentry-trace, x-datadog-trace-id)
    const sourceHeader = req.headers.get("x-incident-source") || "generic";
    const source = ["sentry", "datadog", "pagerduty"].includes(sourceHeader) 
      ? (sourceHeader as any) 
      : "generic";

    console.log(`[WebhookRoute] Received incident webhook from ${source}`);

    // 1. Ingest
    const ingestionService = getIncidentIngestionService();
    const incident = ingestionService.processWebhook(source, payload);

    // Hardcoding for MVP, normally these would come from query params, URL params, or DB lookups 
    // mapped from the incident project
    const url = new URL(req.url);
    const installationId = parseInt(url.searchParams.get("installationId") || "1", 10);
    const owner = url.searchParams.get("owner") || "owner";
    const repo = url.searchParams.get("repo") || "repo";

    // 2. Fetch context
    const deploymentService = getDeploymentAnalysisService();
    const context = await deploymentService.getRecentDeploymentContext(
      installationId,
      owner,
      repo,
      incident.timestamp
    );

    // 3. Correlate
    const correlationService = getIncidentCorrelationService();
    const correlation = await correlationService.correlateIncident(incident, context);

    let rollbackResult = null;
    const report: Partial<IncidentReport> = {
      incidentId: incident.id,
      summary: incident.title,
      severity: incident.severity,
      likelyPrNumber: correlation.likelyPrNumber,
      confidenceScore: correlation.confidenceScore,
      affectedFiles: correlation.impactedFiles,
      rollbackPrepared: false,
      autoMerged: false,
      createdAt: new Date().toISOString(),
    };

    // 4. Trigger Rollback if valid correlation
    if (correlation.likelyPrNumber) {
      const rollbackService = getRollbackPrService();
      rollbackResult = await rollbackService.executeRollback(
        installationId,
        owner,
        repo,
        incident,
        correlation
      );

      if (rollbackResult.success) {
        report.rollbackPrepared = true;
        report.emergencyPrUrl = rollbackResult.prUrl;
        report.autoMerged = rollbackResult.autoMerged || false;
      } else {
        console.warn(`[WebhookRoute] Rollback execution skipped or failed: ${rollbackResult.error}`);
      }
    } else {
      console.warn("[WebhookRoute] No likely PR identified for incident.");
    }

    return NextResponse.json(
      { success: true, report, error: rollbackResult?.error },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[WebhookRoute] Error processing webhook:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
