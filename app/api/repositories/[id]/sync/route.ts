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
        user: { email: session.user.email } 
      }
    });

    if (!existingRepo) {
      return NextResponse.json({ error: "Repository not found or unauthorized" }, { status: 404 });
    }

    // 2. Rate Limiting Logic (Max 2 syncs per minute per USER)
    // FIX: Using user email instead of IP prevents spoofing
    const rateLimitKey = session.user.email; 
    const now = Date.now();
    const windowMs = 60 * 1000; 
    const maxRequests = 2;

    const userState = syncRateLimit.get(rateLimitKey) || { count: 0, lastReset: now };

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
    syncRateLimit.set(rateLimitKey, userState);

  // 3. ACTUAL SYNC LOGIC: Enforce DB transaction boundary to prevent race conditions
    // We wrap the check and update in a single transaction. By updating the repo FIRST,
    // we trigger a PostgreSQL row lock. Concurrent requests will queue up rather than race.
    const updatedRepo = await prisma.$transaction(async (tx) => {
      
      // Step A: Update the timestamp. This locks the repository row for this transaction.
      const repo = await tx.repository.update({
        where: { id: repositoryId },
        data: { lastSyncedAt: new Date() }
      });

      // Step B: Now safely check for existing jobs (concurrent requests are waiting in line)
      const existingJob = await tx.analysisJob.findFirst({
        where: {
          repositoryId: existingRepo.id,
          status: { in: ["QUEUED", "PROCESSING"] }
        }
      });

      // Step C: Safely create the job ONLY if it doesn't exist
      if (!existingJob) {
        await tx.analysisJob.create({
          data: {
            repositoryId: existingRepo.id,
            userId: existingRepo.userId,
            status: "QUEUED",
          }
        });
      }

      return repo;
    });

    return NextResponse.json({ 
      success: true, 
      lastSyncedAt: updatedRepo.lastSyncedAt 
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