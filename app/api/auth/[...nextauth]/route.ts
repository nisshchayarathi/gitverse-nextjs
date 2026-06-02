import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { getNextAuthSecret } from "@/lib/config/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = async (req: any, ctx: any) => {
  return NextAuth({ ...authOptions, secret: getNextAuthSecret() })(req, ctx);
};

export { handler as GET, handler as POST };

