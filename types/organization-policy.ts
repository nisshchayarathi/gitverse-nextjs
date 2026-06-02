export interface OrganizationSecurityPolicy {
  enforceSecurityReviews: boolean;
  enforceSecretScanning: boolean;
  blockCriticalSecrets: boolean;
  blackoutWindowsEnabled: boolean;
  policyLockEnabled: boolean;
}

export interface EffectiveRepositoryPolicy {
  repositoryId: number;
  isInherited: boolean;
  isLocked: boolean;
  enforceSecurityReviews: boolean;
  enforceSecretScanning: boolean;
  blockCriticalSecrets: boolean;
}
