import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; 
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';

// In-memory rate limiter strictly for the sync endpoint
const syncRateLimit = new Map();

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {

    // 1. Security Authorization Check
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const repositoryId = parseInt(params.id);
    if (isNaN(repositoryId)) {
      return NextResponse.json({ error: "Invalid repository ID" }, { status: 400 });
    }

    // Verify the user actually owns this repository before doing anything
    const existingRepo = await prisma.repository.findFirst({
      where: { 
        id: repositoryId,
        user: { email: session.user.email } // Scoped to the authenticated user
      }
    });

    if (!existingRepo) {
      return NextResponse.json({ error: "Repository not found or unauthorized" }, { status: 404 });
    }

    // 2. Rate Limiting Logic (Max 2 syncs per minute per IP)
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const maxRequests = 2;

    const userState = syncRateLimit.get(ip) || { count: 0, lastReset: now };

    if (now - userState.lastReset > windowMs) {
      userState.count = 0;
      userState.lastReset = now;
    }

    if (userState.count >= maxRequests) {
      return NextResponse.json(
        { error: "Too many sync attempts. Please try again in a minute." }, 
        { status: 429 }
      );
    }

    userState.count += 1;
    syncRateLimit.set(ip, userState);

    // 3. ACTUAL SYNC LOGIC: Queue a new background job
    // First, check if there is already a job running so we don't duplicate work
    const existingJob = await prisma.analysisJob.findFirst({
      where: {
        repositoryId: existingRepo.id,
        status: { in: ["QUEUED", "PROCESSING"] }
      }
    });

    // If no job is currently running, create a new one for the worker
    if (!existingJob) {
      await prisma.analysisJob.create({
        data: {
          repositoryId: existingRepo.id,
          userId: existingRepo.userId, // Or whatever the user relation field is named
          status: "QUEUED",
        }
      });
    }

    // 4. Update the timestamp ONLY after successful sync
    const updatedRepo = await prisma.repository.update({
      where: { id: repositoryId },
      data: { lastSyncedAt: new Date() }
    });

    return NextResponse.json({ 
      success: true, 
      lastSyncedAt: updatedRepo.lastSyncedAt 
    });

  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json({ error: "Failed to sync repository" }, { status: 500 });
  }
}