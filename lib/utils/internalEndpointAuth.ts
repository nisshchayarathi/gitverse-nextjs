import crypto from "crypto";

function timingSafeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}

export function isSecretHeaderAuthorized(params: {
  providedSecret: string | null;
  configuredSecret: string | undefined;
}): boolean {
  const configuredSecret = params.configuredSecret?.trim();
  const providedSecret = params.providedSecret?.trim();

  if (!configuredSecret || !providedSecret) {
    return false;
  }

  return timingSafeCompare(providedSecret, configuredSecret);
}

export function isBearerTokenAuthorized(params: {
  authorizationHeader: string | null;
  configuredSecret: string | undefined;
}): boolean {
  const configuredSecret = params.configuredSecret?.trim();
  const authorizationHeader = params.authorizationHeader?.trim();

  if (!configuredSecret || !authorizationHeader?.startsWith("Bearer ")) {
    return false;
  }

  const providedToken = authorizationHeader.slice("Bearer ".length).trim();
  return timingSafeCompare(providedToken, configuredSecret);
}
