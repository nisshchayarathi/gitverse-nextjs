import prisma from "@/lib/prisma";
import { decryptToken } from "@/lib/utils/envelopeEncryption";

export async function getDecryptedGitHubToken(userId: number): Promise<string | null> {
  const account = await prisma.gitHubAccount.findUnique({
    where: { userId },
    select: { accessToken: true, tokenEncrypted: true },
  });

  if (!account?.accessToken) return null;

  if (account.tokenEncrypted) {
    return await decryptToken(account.accessToken);
  }

  return account.accessToken;
}
