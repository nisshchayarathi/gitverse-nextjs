import prisma from "@/lib/prisma";
import { decryptToken } from "@/lib/utils/tokenEncryption";

export async function getDecryptedGitHubToken(userId: number): Promise<string | null> {
  const account = await prisma.gitHubAccount.findUnique({
    where: { userId },
    select: { accessToken: true, tokenEncrypted: true },
  });

  if (!account?.accessToken) return null;

  if (account.tokenEncrypted) {
    return decryptToken(account.accessToken);
  }

  return account.accessToken;
}
