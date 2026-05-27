import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth , sanitizeError } from "@/lib/middleware";
import bcrypt from "bcryptjs";
import { requireAuth, sanitizeError } from "@/lib/middleware";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const userDetails = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
      },
    });

    const hasGoogleAccount =
      (await prisma.account.count({
        where: { userId: user.userId, provider: "google" },
      })) > 0;

    if (!userDetails) {
      return NextResponse.json(
        { error: "User not found" },
        {
          status: 404,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
          },
        },
      );
    }

    return NextResponse.json(
      {
        id: userDetails.id,
        name: userDetails.name,
        email: userDetails.email,
        image: userDetails.image,
        createdAt: userDetails.createdAt,
        avatarUrl: (userDetails as any).image,
        isGoogleLinked: hasGoogleAccount,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, private",
        },
      },
    );
  } catch (error: any) {
    console.error("Error fetching user:", sanitizeError(error));
    return NextResponse.json(
      { error: "Failed to fetch user" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, private",
        },
      },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);

   let body;

try {
  body = await request.json();
} catch {
  return NextResponse.json(
    { error: "Invalid or empty request body" },
    { status: 400 }
  );
}

const { currentPassword } = body;
    if (!currentPassword) {
      return NextResponse.json(
        { error: "Current password is required" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: user.userId },
    });

    if (!existingUser || !existingUser.passwordHash) {
      return NextResponse.json(
        { error: "Password verification unavailable for this account" },
        { status: 400 }
      );
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      existingUser.passwordHash
    );

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 401 }
      );
    }

    await prisma.$transaction([
  prisma.gitHubRepo.deleteMany({
    where: {
      userId: user.userId,
    },
  }),
  prisma.gitHubAccount.deleteMany({
    where: {
      userId: user.userId,
    },
  }),
  prisma.user.delete({
    where: {
      id: user.userId,
    },
  }),
]);

    return NextResponse.json({ message: "Account deleted" });
    // Delete related GitHub repositories
await prisma.gitHubRepo.deleteMany({
  where: {
    userId: user.userId,
  },
});

// Delete related GitHub accounts
await prisma.gitHubAccount.deleteMany({
  where: {
    userId: user.userId,
  },
});

// Delete the user
await prisma.user.delete({
  where: { id: user.userId },
});

return NextResponse.json(
  { message: "Account deleted" },
  {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
    },
  },
);
    
  } catch (error: any) {
    console.error("Error deleting account:", sanitizeError(error));

    if (error?.code === "P2025") {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
        {
          status: 404,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
          },
        },
      );
    }

    return NextResponse.json(
      { error: "Failed to delete account" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, private",
        },
      },
    );
  }
}
