import prisma from "@/lib/prisma";

export async function getGithubAccessToken(userId: number): Promise<string | undefined> {
  try {
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: "github"
      },
      select: {
        access_token: true
      }
    });
    
    return account?.access_token ?? undefined;
  } catch (err) {
    console.error(`Failed to get GitHub access token for user ${userId}:`, err);
    return undefined;
  }
}
