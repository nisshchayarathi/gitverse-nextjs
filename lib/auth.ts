import jwt from 'jsonwebtoken'
import prisma from './prisma'
import { getPrisma } from './prisma'
import type { ExtendedPrismaClient } from './prisma'

import { getJwtSecret } from './config/env';

export interface JWTPayload {
  userId: number;
  email: string;
  tokenVersion?: number;
  iat?: number;
  exp?: number;
}

export interface DecodedToken extends JWTPayload {
  iat: number;
  exp: number;
}

/**
 * Validates that the token's tokenVersion matches the user's current token_version in DB
 * Returns null if token is invalid, expired, or tokenVersion mismatch
 */
export async function verifyTokenWithUserValidation(token: string): Promise<JWTPayload | null> {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as DecodedToken;
    
    // Require tokenVersion in payload for security
    if (decoded.tokenVersion == null) {
      console.warn("[JWT] Token validation failed: Missing tokenVersion in payload");
      return null;
    }
    
    // Fetch user's current token_version from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { tokenVersion: true, lockedUntil: true, passwordChangedAt: true }
    });
    
    if (!user) {
      console.warn(`[JWT] Token validation failed: User ${decoded.userId} not found`);
      return null;
    }
    
    // Check if user is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      console.warn(`[JWT] Token validation failed: User ${decoded.userId} is locked until ${user.lockedUntil}`);
      return null;
    }
    
    // CRITICAL: Validate tokenVersion matches database
    // This prevents token reuse after password changes or logout
    if (decoded.tokenVersion !== user.tokenVersion) {
      console.warn(
        `[JWT] Token validation failed: tokenVersion mismatch. ` +
        `Token has ${decoded.tokenVersion}, DB has ${user.tokenVersion} for user ${decoded.userId}`
      );
      return null;
    }
    
    // Check if password was changed after token was issued
    if (user.passwordChangedAt && decoded.iat) {
      const tokenIssuedAt = new Date(decoded.iat * 1000);
      if (user.passwordChangedAt > tokenIssuedAt) {
        console.warn(
          `[JWT] Token validation failed: Password changed after token issued for user ${decoded.userId}`
        );
        return null;
      }
    }
    
    // Check if token has expired
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now) {
      console.warn(`[JWT] Token validation failed: Token expired for user ${decoded.userId}`);
      return null;
    }
    
    // Verify token hasn't been used before its issued time (clock skew protection)
    if (decoded.iat > now + 60) {
      console.warn(`[JWT] Token validation failed: Token issued in the future for user ${decoded.userId}`);
      return null;
    }
    
    return {
      userId: decoded.userId,
      email: decoded.email,
      tokenVersion: decoded.tokenVersion
    };
  } catch (error: any) {
    console.warn(`[JWT] Token validation error: ${error.message}`);
    
    // Handle specific JWT errors
    if (error?.name === 'TokenExpiredError') {
      console.warn(`[JWT] Token expired`);
      return null;
    }
    
    if (error?.name === 'JsonWebTokenError') {
      console.warn(`[JWT] Invalid token format`);
      return null;
    }
    
    if (error?.name === 'NotBeforeError') {
      console.warn(`[JWT] Token not active yet`);
      return null;
    }
    
    return null;
  }
}

export function generateToken(payload: JWTPayload, options?: jwt.SignOptions): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d', ...options })
}

/**
 * DEPRECATED: Simple token verification without user validation.
 * Use verifyTokenWithUserValidation() instead for production.
 * 
 * This function only validates cryptographic signature and expiration,
 * but does NOT check tokenVersion or password change status.
 * 
 * @deprecated Use verifyTokenWithUserValidation() for security
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Generates a new token version for a user (call on password change, logout, etc.)
 * This invalidates all existing tokens for the user
 */
export async function incrementUserTokenVersion(userId: number): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tokenVersion: true }
  });
  
  if (!user) {
    throw new Error(`User ${userId} not found`);
  }
  
  const newVersion = user.tokenVersion + 1;
  
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: newVersion }
  });
  
  console.log(`[JWT] Token version incremented for user ${userId}: ${user.tokenVersion} -> ${newVersion}`);
  
  return newVersion;
}

/**
 * Validates token version without database lookup for performance
 * Used when user data is already loaded
 */
export function validateTokenVersion(
  tokenPayload: JWTPayload,
  dbUser: { tokenVersion: number; lockedUntil?: Date | null; passwordChangedAt?: Date | null }
): boolean {
  // Check if user is locked
  if (dbUser.lockedUntil && dbUser.lockedUntil > new Date()) {
    return false;
  }
  
  // Validate tokenVersion matches
  if (tokenPayload.tokenVersion == null || tokenPayload.tokenVersion !== dbUser.tokenVersion) {
    return false;
  }
  
  // Check if password was changed after token was issued
  if (dbUser.passwordChangedAt && tokenPayload.iat) {
    const tokenIssuedAt = new Date(tokenPayload.iat * 1000);
    if (dbUser.passwordChangedAt > tokenIssuedAt) {
      return false;
    }
  }
  
  return true;
}

/**
 * Creates a signed JWT token with proper tokenVersion for session management
 */
export function createSignedToken(
  userId: number,
  email: string,
  tokenVersion: number
): string {
  const payload: JWTPayload = {
    userId,
    email,
    tokenVersion,
  };
  
  return generateToken(payload);
}

/**
 * Extracts token information without verifying signature
 * Useful for logging, metrics, and debugging
 */
export function extractTokenInfo(token: string): {
  userId: number;
  email: string;
  tokenVersion: number;
  iat: number;
  exp: number;
  isValidFormat: boolean;
  isExpired: boolean;
} | null {
  try {
    // Decode without verifying (just base64 decode)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const payloadBase64 = parts[1];
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
    
    const now = Math.floor(Date.now() / 1000);
    
    return {
      userId: payload.userId,
      email: payload.email,
      tokenVersion: payload.tokenVersion,
      iat: payload.iat,
      exp: payload.exp,
      isValidFormat: true,
      isExpired: payload.exp < now,
    };
  } catch {
    return null;
  }
}

/**
 * Validates token expiration without cryptographic verification
 * Used for quick checks and logging
 */
export function isTokenExpired(token: string): boolean {
  try {
    const info = extractTokenInfo(token);
    if (!info) return true;
    return info.isExpired;
  } catch {
    return true;
  }
}

/**
 * Gets token remaining time in seconds
 * Returns negative number if expired
 */
export function getTokenRemainingSeconds(token: string): number {
  try {
    const info = extractTokenInfo(token);
    if (!info) return 0;
    
    const now = Math.floor(Date.now() / 1000);
    return info.exp - now;
  } catch {
    return 0;
  }
}

/**
 * Validates all required fields are present in token payload
 */
export function isValidTokenPayload(payload: JWTPayload): boolean {
  return (
    typeof payload.userId === 'number' &&
    typeof payload.email === 'string' &&
    payload.email.length > 0 &&
    payload.tokenVersion != null &&
    typeof payload.tokenVersion === 'number' &&
    payload.tokenVersion > 0
  );
}

/**
 * Cleans token payload for safe logging (removes sensitive data)
 */
export function sanitizeTokenPayload(payload: JWTPayload | null): {
  userId: number | null;
  hasEmail: boolean;
  hasTokenVersion: boolean;
} | null {
  if (!payload) return null;
  
  return {
    userId: payload.userId,
    hasEmail: payload.email ? payload.email.length > 0 : false,
    hasTokenVersion: payload.tokenVersion != null,
  };
}

/**
 * Compares two tokens to check if they belong to the same user session
 */
export function areTokensFromSameSession(token1: string, token2: string): boolean {
  try {
    const payload1 = jwt.decode(token1) as JWTPayload;
    const payload2 = jwt.decode(token2) as JWTPayload;
    
    if (!payload1 || !payload2) return false;
    
    return (
      payload1.userId === payload2.userId &&
      payload1.tokenVersion === payload2.tokenVersion
    );
  } catch {
    return false;
  }
}

/**
 * Token statistics for monitoring and alerting
 */
export interface TokenStats {
  validTokens: number;
  expiredTokens: number;
  invalidTokens: number;
  missingTokenVersion: number;
  tokenVersionMismatches: number;
}

/**
 * Analyzes a batch of tokens for monitoring purposes
 */
export async function analyzeTokens(tokens: string[]): Promise<TokenStats> {
  const stats: TokenStats = {
    validTokens: 0,
    expiredTokens: 0,
    invalidTokens: 0,
    missingTokenVersion: 0,
    tokenVersionMismatches: 0,
  };
  
  for (const token of tokens) {
    try {
      // Check expiration first (no DB call)
      const remainingSeconds = getTokenRemainingSeconds(token);
      
      if (remainingSeconds < 0) {
        stats.expiredTokens++;
        continue;
      }
      
      // Parse payload
      const payload = jwt.decode(token) as JWTPayload;
      if (!payload) {
        stats.invalidTokens++;
        continue;
      }
      
      if (payload.tokenVersion == null) {
        stats.missingTokenVersion++;
        continue;
      }
      
      // Check DB for token version (requires DB call - batch this for production)
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { tokenVersion: true }
      });
      
      if (!user) {
        stats.invalidTokens++;
        continue;
      }
      
      if (user.tokenVersion !== payload.tokenVersion) {
        stats.tokenVersionMismatches++;
        continue;
      }
      
      stats.validTokens++;
    } catch {
      stats.invalidTokens++;
    }
  }
  
  return stats;
}

/**
 * Token invalidation result for audit logging
 */
export interface TokenInvalidateResult {
  success: boolean;
  userId: number;
  oldVersion: number;
  newVersion: number;
  reason: string;
  timestamp: Date;
}

/**
 * Invalidates all tokens for a user and returns the new version
 */
export async function invalidateAllUserTokens(
  userId: number,
  reason: string = 'Manual invalidation'
): Promise<TokenInvalidateResult | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tokenVersion: true }
    });
    
    if (!user) {
      return null;
    }
    
    const newVersion = await incrementUserTokenVersion(userId);
    
    return {
      success: true,
      userId,
      oldVersion: user.tokenVersion,
      newVersion,
      reason,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error(`[JWT] Failed to invalidate tokens for user ${userId}:`, error);
    return null;
  }
}

/**
 * Batch invalidates tokens for multiple users
 */
export async function batchInvalidateUserTokens(
  userIds: number[],
  reason: string = 'Batch invalidation'
): Promise<TokenInvalidateResult[]> {
  const results: TokenInvalidateResult[] = [];
  
  for (const userId of userIds) {
    const result = await invalidateAllUserTokens(userId, reason);
    if (result) {
      results.push(result);
    }
  }
  
  return results;
}

/**
 * Token rotation for session security
 * Creates a new token while invalidating the old one
 */
export async function rotateToken(
  oldToken: string,
  userId: number,
  email: string
): Promise<{ newToken: string; oldVersion: number; newVersion: number } | null> {
  try {
    // First, validate the old token
    const payload = jwt.decode(oldToken) as JWTPayload;
    if (!payload || payload.userId !== userId) {
      return null;
    }
    
    // Get current token version
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tokenVersion: true }
    });
    
    if (!user) {
      return null;
    }
    
    const oldVersion = user.tokenVersion;
    
    // Generate new token with incremented version
    const newVersion = oldVersion + 1;
    
    const newToken = createSignedToken(userId, email, newVersion);
    
    // Update database
    await prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: newVersion }
    });
    
    return {
      newToken,
      oldVersion,
      newVersion,
    };
  } catch (error) {
    console.error(`[JWT] Token rotation failed for user ${userId}:`, error);
    return null;
  }
}

/**
 * Validates token for password change flow
 * Ensures the user's password wasn't changed after token issuance
 */
export async function validateTokenForPasswordChange(
  token: string,
  userId: number
): Promise<boolean> {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as DecodedToken;
    
    // Verify user owns this token
    if (decoded.userId !== userId) {
      return false;
    }
    
    // Get user's password change timestamp
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordChangedAt: true }
    });
    
    if (!user || !user.passwordChangedAt) {
      // No password change yet - token is valid
      return true;
    }
    
    // Check if password was changed after token was issued
    const tokenIssuedAt = new Date(decoded.iat * 1000);
    return user.passwordChangedAt <= tokenIssuedAt;
  } catch {
    return false;
  }
}

/**
 * Token cleanup job for removing stale tokens from logs
 * Run periodically to maintain security hygiene
 */
export async function cleanupStaleTokens(): Promise<number> {
  // This is a placeholder for a future cleanup job
  // In production, you might want to:
  // 1. Find tokens that were invalidated but still in logs
  // 2. Remove old token version records
  // 3. Archive old token validation events
  
  return 0;
}

/**
 * Logs token validation events for audit trail
 */
export async function logTokenValidation(
  userId: number,
  email: string,
  isValid: boolean,
  reason?: string
): Promise<void> {
  // In production, you might want to:
  // 1. Log to a dedicated audit table
  // 2. Send to a monitoring system
  // 3. Create alerts for suspicious patterns
  
  if (!isValid) {
    console.warn(`[JWT Audit] Invalid token validation for user ${userId} (${email})${reason ? `: ${reason}` : ''}`);
  }
}

/**
 * Configuration for JWT token management
 */
export interface JWTConfig {
  secret: string;
  tokenExpiry: string;
  requireTokenVersion: boolean;
  validatePasswordChange: boolean;
}

/**
 * Gets the current JWT configuration
 */
export function getJWTConfig(): JWTConfig {
  return {
    secret: getJwtSecret(),
    tokenExpiry: '7d',
    requireTokenVersion: true,
    validatePasswordChange: true,
  };
}

/**
 * Validates JWT configuration before server start
 */
export function validateJWTConfig(): boolean {
  const config = getJWTConfig();
  
  if (!config.secret || config.secret.length < 32) {
    console.error('[JWT] JWT_SECRET must be at least 32 characters');
    return false;
  }
  
  if (config.secret === 'your-secret-key') {
    console.error('[JWT] JWT_SECRET is using default value - this is insecure!');
    return false;
  }
  
  return true;
}

/**
 * Initial JWT validation on application startup
 */
export function initializeJWT(): boolean {
  if (!validateJWTConfig()) {
    console.error('[JWT] Configuration validation failed');
    return false;
  }
  
  console.log('[JWT] JWT configuration validated successfully');
  return true;
}

// Auto-validate on import in production
if (process.env.NODE_ENV === 'production') {
  initializeJWT();
}
