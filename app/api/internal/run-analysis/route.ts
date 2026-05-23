import { NextResponse } from 'next/server';
import { startAnalysisWorkerLoop } from '../../../../scripts/analysisWorker';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow maximum serverless execution time

export async function GET(request: Request) {
  // Simple auth check for internal cron jobs
  const authHeader = request.headers.get('authorization');
  if (
    process.env.ANALYSIS_RUNNER_SECRET &&
    authHeader !== `Bearer ${process.env.ANALYSIS_RUNNER_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const timeBudgetStr = searchParams.get('timeBudgetMs');
  
  // Default to 45 seconds (45000ms) to allow graceful shutdown before typical 60s timeout
  // Can be configured via query parameter for longer-running environments
  let timeBudgetMs = 45000;
  if (timeBudgetStr) {
    const parsed = parseInt(timeBudgetStr, 10);
    if (!isNaN(parsed) && parsed > 0) {
      timeBudgetMs = parsed;
    }
  }

  try {
    const startTime = Date.now();
    console.log(`Starting analysis cron run with time budget: ${timeBudgetMs}ms`);

    // Run the worker loop. It will exit when timeBudgetMs is reached or if it runs out of jobs (since it's not a daemon in this context)
    // Wait, we don't want it to run indefinitely if there are no jobs.
    // If we set once=false, it will loop until timeBudgetMs. If there are no jobs, it will sleep.
    // That's acceptable since we want it to process as many jobs as possible within the budget.
    // However, if we just want it to process one job and exit, we'd set once: true.
    // Let's pass once: false so it acts as a queue processor within the time budget.
    await startAnalysisWorkerLoop({ 
      once: false, 
      timeBudgetMs 
    });
    
    const elapsed = Date.now() - startTime;
    console.log(`Finished analysis cron run in ${elapsed}ms`);
    
    return NextResponse.json({ 
      success: true, 
      message: `Cron execution finished in ${elapsed}ms`,
      elapsedMs: elapsed
    });
  } catch (error: any) {
    console.error('run-analysis cron error:', error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
