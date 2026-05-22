import { NextResponse } from 'next/server';
import { startAnalysisWorkerLoop } from '../../../../scripts/analysisWorker';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function secureCompare(a: string | null, b: string | null): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function GET(request: Request) {
  // Simple auth check for internal cron
  const authHeader = request.headers.get('authorization');
  if (
    process.env.ANALYSIS_RUNNER_SECRET &&
    authHeader !== `Bearer ${process.env.ANALYSIS_RUNNER_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const maxJobsParam = url.searchParams.get('maxJobs');
  const parsedMaxJobs = maxJobsParam ? parseInt(maxJobsParam, 10) : undefined;
  const maxJobs = parsedMaxJobs != null && !isNaN(parsedMaxJobs) && parsedMaxJobs > 0 
    ? parsedMaxJobs 
    : undefined;

  console.log(`Starting analysis cron run... (maxJobs: ${maxJobs ?? 'default'})`);

  try {
    // Run the worker loop with maxJobs if provided, otherwise "once" mode
    const metrics = await startAnalysisWorkerLoop({ 
      once: maxJobs === undefined,
      maxJobs
    });

    console.log(`Finished analysis cron run. Summary:`, metrics);

    return NextResponse.json({
      success: metrics.success,
      message: 'Analysis worker execution completed',
      metrics,
    });
  } catch (error: any) {
    console.error('run-analysis cron error:', error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({
      error: 'Internal server error',
      success: false,
    }, { status: 500 });
  }
}
