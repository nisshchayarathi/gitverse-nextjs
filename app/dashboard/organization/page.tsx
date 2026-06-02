import React from "react";
import { PolicyStatusCard } from "@/components/organization/PolicyStatusCard";
import { PolicyManager } from "@/components/organization/PolicyManager";
import { RepositoryAssignments } from "@/components/organization/RepositoryAssignments";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";

export default async function OrganizationDashboard() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    redirect("/login");
  }

  // Find user and their organizations
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      organizationMemberships: {
        include: {
          organization: {
            include: {
              policies: true,
              repositories: {
                include: { repository: true }
              }
            }
          }
        }
      }
    }
  });

  if (!user || user.organizationMemberships.length === 0) {
    return (
      <div className="p-8 max-w-7xl mx-auto text-slate-300">
        <h1 className="text-3xl font-bold text-white mb-4">Organization Security</h1>
        <p>You are not currently a member of any organization on GitVerse.</p>
      </div>
    );
  }

  // Assuming managing the first org for simplicity in this view
  const org = user.organizationMemberships[0].organization;
  const policies = org.policies || {
    enforceSecurityReviews: false,
    enforceSecretScanning: false,
    blockCriticalSecrets: false,
    blackoutWindowsEnabled: false,
    policyLockEnabled: false,
  };

  const savePolicies = async (updatedPolicies: any) => {
    "use server";
    
    await prisma.organizationPolicy.upsert({
      where: { organizationId: org.id },
      create: {
        organizationId: org.id,
        ...updatedPolicies
      },
      update: updatedPolicies
    });

    revalidatePath("/dashboard/organization");
  };

  const mappedRepos = org.repositories.map(assignment => ({
    id: assignment.repository.id,
    name: assignment.repository.name,
    isInherited: assignment.inheritedPolicy,
  }));

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-white mb-2">{org.name} - Security Settings</h1>
        <p className="text-slate-400">Manage centralized security policies and repository enforcement rules.</p>
      </header>

      <PolicyStatusCard 
        governedRepos={org.repositories.length}
        recentViolations={0} // To be connected to AuditLogs
        blockedMerges={0} // To be connected to AuditLogs
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <PolicyManager initialPolicies={policies} onSave={savePolicies} />
        <RepositoryAssignments repositories={mappedRepos} isLocked={policies.policyLockEnabled} />
      </div>
    </div>
  );
}
