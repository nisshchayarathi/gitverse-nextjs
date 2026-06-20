import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { getNextAuthSecret } from "@/lib/config/env";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = async (req: any, ctx: any) => {
  if (process.env.PLAYWRIGHT_TEST === "true" && process.env.NODE_ENV !== "production") {
    try {
      const cookieStore = cookies();
      const mockSession = cookieStore.get("mock-session")?.value;
      if (mockSession === "true") {
        const url = new URL(req.url || "", "http://localhost");
        if (url.pathname.endsWith("/api/auth/session")) {
          return NextResponse.json({
            user: {
              id: "1",
              name: "Test User",
              email: "test@test.com",
              image: null,
            },
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          });
        }
      }
    } catch (err) {
      console.error("[mock-session] Failed to process mock session:", err);
    }
  }
  return NextAuth({ ...authOptions, secret: getNextAuthSecret() })(req, ctx);
};

export { handler as GET, handler as POST };


