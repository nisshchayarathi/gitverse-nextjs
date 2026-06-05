import prisma from "@/lib/prisma";

export type Role = "ORG_ADMIN" | "REPO_ADMIN" | "MAINTAINER" | "CONTRIBUTOR" | "READER";

export async function hasRepoRole(userId: number, repositoryId: number, allowedRoles: Role[]): Promise<boolean> {
  const repo = await prisma.repository.findUnique({
    where: { id: repositoryId },
    select: { userId: true },
  });

  if (!repo) return false;
  if (repo.userId === userId) return true; // Owner has all permissions

  // Note: We'd check OrganizationMember or RepositoryMember models here.
  // Assuming a check exists or defaults to checking OrganizationMember.
  const member = await prisma.organizationMember.findFirst({
    where: {
      userId,
      organization: { repositories: { some: { repositoryId } } }
    },
    select: { role: true },
  });

  if (!member) return false;

  return allowedRoles.includes(member.role as Role);
}

export async function requireRepoRole(userId: number, repositoryId: number, allowedRoles: Role[]): Promise<void> {
  const hasRole = await hasRepoRole(userId, repositoryId, allowedRoles);
  if (!hasRole) {
    throw new Error("Forbidden: Insufficient permissions.");
  }
}
