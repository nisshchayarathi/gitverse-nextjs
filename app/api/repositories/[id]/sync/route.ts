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

    // 3. ACTUAL SYNC LOGIC: Enforce DB transaction to prevent race conditions
    const jobResult = await prisma.$transaction(async (tx) => {
      
      // Step A: Lock the repository row at the database level. 
      // This forces any exact-millisecond concurrent requests to wait in line.
      await tx.$executeRaw`SELECT id FROM "repositories" WHERE id = ${repositoryId} FOR UPDATE`;

      // Step B: Safely check for existing jobs
      const existingJob = await tx.analysisJob.findFirst({
        where: {
          repositoryId: existingRepo.id,
          status: { in: ["QUEUED", "PROCESSING"] }
        }
      });

      if (existingJob) {
        return { status: "ALREADY_QUEUED" };
      }

      // Step C: Create the job ONLY if one isn't already running
      await tx.analysisJob.create({
        data: {
          repositoryId: existingRepo.id,
          userId: existingRepo.userId,
          status: "QUEUED",
        }
      });

      return { status: "NEWLY_QUEUED" };
    });

    // Step 4: Return success WITHOUT stamping the timestamp.
    // The background worker is now responsible for updating lastSyncedAt when it finishes!
    return NextResponse.json({ 
      success: true, 
      message: jobResult.status === "ALREADY_QUEUED" ? "Sync already in progress" : "Sync queued",
      status: jobResult.status
    });

  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json({ error: "Failed to sync repository" }, { status: 500 });
  }
}