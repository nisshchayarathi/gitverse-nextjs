import prisma from "@/lib/prisma";
import { decryptToken } from "@/lib/utils/envelopeEncryption";

export async function getGithubAccessToken(userId: number): Promise<string | undefined> {
  try {
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: "github"
      },
      select: {
        access_token: true,
        tokenEncrypted: true,
      }
    });

    if (!account?.access_token) return undefined;

    if (account.tokenEncrypted) {
      return await decryptToken(account.access_token);
    }

    return account.access_token;
  } catch (err) {
    console.error(`Failed to get GitHub access token for user ${userId}:`, err);
    return undefined;
  }
}
