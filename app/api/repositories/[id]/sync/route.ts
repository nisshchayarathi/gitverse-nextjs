import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; 

// In-memory rate limiter strictly for the sync endpoint
const syncRateLimit = new Map();

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    // 1. Rate Limiting Logic (Max 2 syncs per minute per IP)
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

    // 2. Database Update Logic
    const repositoryId = parseInt(params.id);

    if (isNaN(repositoryId)) {
      return NextResponse.json({ error: "Invalid repository ID" }, { status: 400 });
    }

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