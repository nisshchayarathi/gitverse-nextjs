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
exports.errorResponse = errorResponse;
const server_1 = require("next/server");
const auth_1 = require("./auth");
const jwt_1 = require("next-auth/jwt");
const prisma_1 = __importDefault(require("./prisma"));
async function getAuthUser(request) {
    const authHeader = request.headers.get("authorization");
    let userPayload = null;
    // 1) Existing JWT auth (Authorization: Bearer ...)
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const payload = (0, auth_1.verifyToken)(token);
        if (payload) {
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
                if (Number.isFinite(userId)) {
                    userPayload = { userId, email: token.email };
                }
            }
        }
        catch {
            // Ignore token retrieval errors
        }
    }
    if (!userPayload)
        return null;
    // 3) Verify user existence in database to block deleted users with active JWTs
    try {
        const userExists = await prisma_1.default.user.findUnique({
            where: { id: userPayload.userId },
            select: { id: true },
        });
        if (!userExists)
            return null;
    }
    catch (error) {
        console.error("Database check failed in auth middleware:", error);
        return null;
    }
    return userPayload;
}
async function requireAuth(request) {
    const user = await getAuthUser(request);
    if (!user) {
        throw new HttpError(401, "Unauthorized");
    }
    return user;
}
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
        return str.length > 200 ? str.substring(0, 200) + "..." : str;
    }
    catch {
        return "Unknown error";
    }
}
function errorResponse(message, status = 400) {
    return server_1.NextResponse.json({ error: message }, { status });
}
