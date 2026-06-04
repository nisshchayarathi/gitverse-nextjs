import prisma from "@/lib/prisma";

export async function cleanupExpiredBlacklistedTokens(): Promise<number> {
  const result = await prisma.blacklistedToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  if (result.count > 0) {
    console.log(`[TokenCleanup] Purged ${result.count} expired blacklisted token(s)`);
  }
  return result.count;
}
