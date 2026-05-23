import { NextResponse } from 'next/server';
import { startAnalysisWorkerLoop } from '../../../../../scripts/analysisWorker';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // max Vercel function duration (if supported by plan)

export async function GET(request: Request) {
  // Simple auth check for internal cron
  const authHeader = request.headers.get('authorization');
  if (
    process.env.ANALYSIS_RUNNER_SECRET &&
    authHeader !== `Bearer ${process.env.ANALYSIS_RUNNER_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('Starting analysis cron run...');

  try {
    // Run the worker loop in "once" mode so it returns after one pass through the queue
    await startAnalysisWorkerLoop({ 
      once: true
    });
    
    console.log(`Finished analysis cron run.`);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Analysis worker execution completed'
    });
  } catch (error: any) {
    console.error('run-analysis cron error:', error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ 
      error: 'Internal server error',
      success: false
    }, { status: 500 });
  }
}
