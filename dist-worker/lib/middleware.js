"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpError = void 0;
exports.getAuthUser = getAuthUser;
exports.requireAuth = requireAuth;
exports.requireOwnership = requireOwnership;
exports.isHttpError = isHttpError;
exports.sanitizeError = sanitizeError;
exports.badRequestResponse = badRequestResponse;
exports.getPrismaErrorResponse = getPrismaErrorResponse;
const server_1 = require("next/server");
const auth_1 = require("./auth");
const prisma_1 = __importDefault(require("@/lib/prisma"));
const jwt_1 = require("next-auth/jwt");
/**
 * Resolves the authenticated user from either a JWT bearer token
 * or a NextAuth session cookie.
 * Rejects tokens issued before the user's latest password change.
 */
async function getAuthUser(request) {
    const authHeader = request.headers.get("authorization");
    let userPayload = null;
    // 1) Existing JWT auth (Authorization: Bearer ...)
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const payload = (0, auth_1.verifyToken)(token);
        if (payload) {
            const dbUser = await prisma_1.default.user.findUnique({
                where: { id: payload.userId },
                select: {
                    id: true,
                    passwordChangedAt: true,
                },
            });
            if (!dbUser) {
                return null;
            }
            const issuedAt = typeof payload.iat === "number"
                ? payload.iat
                : null;
            if (dbUser.passwordChangedAt &&
                (issuedAt === null ||
                    issuedAt * 1000 <=
                        dbUser.passwordChangedAt.getTime())) {
                return null;
            }
            userPayload = payload;
        }
    }
    // 2) NextAuth session cookie (Google OAuth)
    if (!userPayload) {
        try {
            const token = await (0, jwt_1.getToken)({
                req: request,
                secret: process.env.NEXTAUTH_SECRET,
            });
            if (token?.sub && token.email) {
                const userId = Number(token.sub);
                if (!Number.isFinite(userId)) {
                    return null;
                }
                const dbUser = await prisma_1.default.user.findUnique({
                    where: { id: userId },
                    select: {
                        id: true,
                        passwordChangedAt: true,
                    },
                });
                if (!dbUser) {
                    return null;
                }
                const issuedAt = typeof token.iat === "number"
                    ? token.iat
                    : null;
                if (dbUser.passwordChangedAt &&
                    (issuedAt === null ||
                        issuedAt * 1000 <=
                            dbUser.passwordChangedAt.getTime())) {
                    return null;
                }
                userPayload = {
                    userId,
                    email: token.email,
                };
            }
        }
        catch {
            // Ignore token retrieval errors
        }
    }
    if (!userPayload)
        return null;
    // 3) Verify user existence and token version
    try {
        const dbUser = await prisma_1.default.user.findUnique({
            where: { id: userPayload.userId },
            select: {
                id: true,
                tokenVersion: true,
                lockedUntil: true,
            },
        });
        if (!dbUser) {
            return null;
        }
        if (dbUser.lockedUntil && dbUser.lockedUntil > new Date()) {
            return null;
        }
        const isJwtAuth = !!(authHeader &&
            authHeader.startsWith("Bearer "));
        // JWT-authenticated users must provide a valid tokenVersion.
        // This allows logout/password-change invalidation to immediately
        // revoke previously issued tokens.
        if (isJwtAuth) {
            // Reject legacy JWTs without tokenVersion
            if (userPayload.tokenVersion == null) {
                return null;
            }
            // Require exact token version match
            if (userPayload.tokenVersion !==
                dbUser.tokenVersion) {
                return null;
            }
        }
    }
    catch (error) {
        console.error("Database check failed in auth middleware:", error);
        return null;
    }
    return userPayload;
}
/**
 * Ensures the incoming request is authenticated.
 * Throws an HttpError if authentication fails.
 */
async function requireAuth(request) {
    const user = await getAuthUser(request);
    if (!user) {
        throw new HttpError(401, "Unauthorized");
    }
    return user;
}
/**
 * Ensures the authenticated user owns the requested resource.
 */
async function requireOwnership(request, resourceUserId) {
    const user = await requireAuth(request);
    if (user.userId !== resourceUserId) {
        throw new HttpError(403, "Forbidden");
    }
    return user;
}
class HttpError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
exports.HttpError = HttpError;
function isHttpError(error) {
    return (typeof error === "object" &&
        error !== null &&
        "status" in error &&
        typeof error.status === "number");
}
function sanitizeError(error) {
    if (error instanceof Error) {
        return error.message;
    }
    try {
        const str = String(error);
        return str.length > 200
            ? str.substring(0, 200) + "..."
            : str;
    }
    catch {
        return "Unknown error";
    }
}
function badRequestResponse(message, status = 400) {
    return server_1.NextResponse.json({ error: message }, { status });
}
function getPrismaErrorResponse(error) {
    const isColdStartError = error?.code === 'P1001' ||
        error?.code === 'P2024' ||
        error?.message?.toLowerCase().includes('timeout') ||
        error?.message?.toLowerCase().includes('connection pool') ||
        error?.message?.toLowerCase().includes('connect') ||
        error?.message?.toLowerCase().includes('fetch failed');
    if (isColdStartError) {
        return server_1.NextResponse.json({ error: "DATABASE_COLD_START", message: "Waking up database..." }, { status: 503 });
    }
    return null;
}
