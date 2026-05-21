"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpError = void 0;
exports.getAuthUser = getAuthUser;
exports.requireAuth = requireAuth;
exports.isHttpError = isHttpError;
const auth_1 = require("./auth");
const jwt_1 = require("next-auth/jwt");
async function getAuthUser(request) {
    const authHeader = request.headers.get("authorization");
    // 1) Existing JWT auth (Authorization: Bearer ...)
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const payload = (0, auth_1.verifyToken)(token);
        if (payload)
            return payload;
    }
    // 2) NextAuth session cookie (Google OAuth)
    try {
        const token = await (0, jwt_1.getToken)({
            req: request,
            secret: process.env.NEXTAUTH_SECRET,
        });
        if (!token?.sub || !token.email)
            return null;
        const userId = Number(token.sub);
        if (!Number.isFinite(userId))
            return null;
        return { userId, email: token.email };
    }
    catch {
        return null;
    }
}
async function requireAuth(request) {
    const user = await getAuthUser(request);
    if (!user) {
        throw new HttpError(401, "Unauthorized");
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
