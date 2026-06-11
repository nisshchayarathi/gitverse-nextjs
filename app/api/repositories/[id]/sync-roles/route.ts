import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { GitHubService } from "@/lib/services/githubService";
import { requireAuth } from "@/lib/middleware";
import { getDecryptedGitHubToken } from "@/lib/utils/githubToken";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    const repositoryId = Number(params.id);

    const repo = await prisma.repository.findUnique({
      where: { id: repositoryId },
      include: { user: { include: { githubAccount: true } } }
    });

    if (!repo || !repo.user.githubAccount) {
      return NextResponse.json({ error: "Repository or GitHub account not found" }, { status: 404 });
    }

    if (repo.userId !== user.userId) {
      return NextResponse.json({ error: "Forbidden: Only owner can sync roles" }, { status: 403 });
    }

    const token = await getDecryptedGitHubToken(repo.user.id);
    if (!token) {
      return NextResponse.json({ error: "Failed to get GitHub token" }, { status: 500 });
    }
    const githubService = new GitHubService(token);
    const parts = repo.url.split("/");
    const owner = parts[parts.length - 2];
    const name = parts[parts.length - 1];

    const collaborators = await githubService.getCollaborators(owner, name);
    
    // We need an organization ID for OrganizationMember, if one doesn't exist, we skip.
    const policyAssignment = await prisma.repositoryPolicyAssignment.findUnique({
      where: { repositoryId }
    });

    if (!policyAssignment) {
       return NextResponse.json({ error: "Repository is not assigned to an organization" }, { status: 400 });
    }

    for (const collab of collaborators) {
      const dbUser = await prisma.gitHubAccount.findFirst({
        where: { username: collab.login },
        include: { user: true }
      });

      if (dbUser) {
        let role = "VIEWER";
        if (collab.permissions.admin) role = "REPO_ADMIN";
        else if (collab.permissions.push) role = "CONTRIBUTOR";
        
        await prisma.organizationMember.upsert({
          where: {
            organizationId_userId: {
              organizationId: policyAssignment.organizationId,
              userId: dbUser.user.id
            }
          },
          update: { role },
          create: {
            organizationId: policyAssignment.organizationId,
            userId: dbUser.user.id,
            role
          }
        });
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Sync roles error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
