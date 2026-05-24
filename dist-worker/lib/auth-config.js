"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authOptions = void 0;
const google_1 = __importDefault(require("next-auth/providers/google"));
const credentials_1 = __importDefault(require("next-auth/providers/credentials"));
const prisma_1 = __importDefault(require("@/lib/prisma"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const dns_1 = __importDefault(require("dns"));
const google_auth_library_1 = require("google-auth-library");
// Some environments resolve Google endpoints to IPv6 first, but IPv6 egress may be blocked.
// This avoids intermittent OAuth callback failures like AggregateError [ETIMEDOUT].
dns_1.default.setDefaultResultOrder("ipv4first");
function intUserId(id) {
    const value = Number(id);
    if (!Number.isFinite(value)) {
        throw new Error("Invalid user id");
    }
    return value;
}
function toAdapterUser(user) {
    return {
        id: String(user.id),
        email: user.email,
        name: user.name,
        image: user.image ?? null,
        emailVerified: user.emailVerified ?? null,
    };
}
function prismaIntIdAdapter() {
    return {
        async createUser(data) {
            const created = await prisma_1.default.user.create({
                data: {
                    email: data.email,
                    name: data.name ?? data.email,
                    image: data.image,
                    emailVerified: data.emailVerified,
                    passwordHash: null,
                },
            });
            return toAdapterUser(created);
        },
        async getUser(id) {
            const user = await prisma_1.default.user.findUnique({
                where: { id: intUserId(id) },
            });
            return user ? toAdapterUser(user) : null;
        },
        async getUserByEmail(email) {
            if (!email)
                return null;
            const user = await prisma_1.default.user.findUnique({ where: { email } });
            return user ? toAdapterUser(user) : null;
        },
        async getUserByAccount({ provider, providerAccountId }) {
            const account = await prisma_1.default.account.findUnique({
                where: { provider_providerAccountId: { provider, providerAccountId } },
                include: { user: true },
            });
            return account?.user ? toAdapterUser(account.user) : null;
        },
        async updateUser(data) {
            const updated = await prisma_1.default.user.update({
                where: { id: intUserId(data.id) },
                data: {
                    email: data.email ?? undefined,
                    name: data.name ?? undefined,
                    image: data.image ?? undefined,
                    emailVerified: data.emailVerified ?? undefined,
                },
            });
            return toAdapterUser(updated);
        },
        async deleteUser(id) {
            await prisma_1.default.user.delete({ where: { id: intUserId(id) } });
        },
        async linkAccount(account) {
            const data = {
                ...account,
                userId: intUserId(account.userId),
            };
            await prisma_1.default.account.create({ data });
            return account;
        },
        async unlinkAccount({ provider, providerAccountId, }) {
            await prisma_1.default.account.delete({
                where: { provider_providerAccountId: { provider, providerAccountId } },
            });
        },
        async createSession(session) {
            const created = await prisma_1.default.session.create({
                data: {
                    sessionToken: session.sessionToken,
                    userId: intUserId(session.userId),
                    expires: session.expires,
                },
            });
            return {
                sessionToken: created.sessionToken,
                userId: String(created.userId),
                expires: created.expires,
            };
        },
        async getSessionAndUser(sessionToken) {
            const session = await prisma_1.default.session.findUnique({
                where: { sessionToken },
                include: { user: true },
            });
            if (!session)
                return null;
            return {
                session: {
                    sessionToken: session.sessionToken,
                    userId: String(session.userId),
                    expires: session.expires,
                },
                user: toAdapterUser(session.user),
            };
        },
        async updateSession(session) {
            const updated = await prisma_1.default.session.update({
                where: { sessionToken: session.sessionToken },
                data: {
                    expires: session.expires ?? undefined,
                    userId: session.userId ? intUserId(session.userId) : undefined,
                },
            });
            return {
                sessionToken: updated.sessionToken,
                userId: String(updated.userId),
                expires: updated.expires,
            };
        },
        async deleteSession(sessionToken) {
            await prisma_1.default.session.delete({ where: { sessionToken } });
        },
        async createVerificationToken(token) {
            const created = await prisma_1.default.verificationToken.create({
                data: token,
            });
            return created;
        },
        async useVerificationToken(token) {
            try {
                const deleted = await prisma_1.default.verificationToken.delete({
                    where: {
                        identifier_token: {
                            identifier: token.identifier,
                            token: token.token,
                        },
                    },
                });
                return deleted;
            }
            catch {
                return null;
            }
        },
    };
}
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const looksLikePlaceholder = (value) => {
    if (!value)
        return true;
    const normalized = value.trim().toLowerCase();
    return (normalized === "your-client-secret" ||
        normalized === "your-google-client-secret" ||
        normalized === "your-google-client-id.apps.googleusercontent.com" ||
        normalized.startsWith("your-"));
};
const isGoogleConfigured = !!googleClientId &&
    !!googleClientSecret &&
    !looksLikePlaceholder(googleClientId) &&
    !looksLikePlaceholder(googleClientSecret);
const googleTokenVerifier = isGoogleConfigured
    ? new google_auth_library_1.OAuth2Client({ clientId: googleClientId })
    : null;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function isTransientNetworkError(error) {
    const anyErr = error;
    const code = anyErr?.code;
    const message = anyErr?.message || "";
    return (code === "ETIMEDOUT" ||
        code === "ECONNRESET" ||
        code === "EAI_AGAIN" ||
        code === "ENOTFOUND" ||
        message.includes("ETIMEDOUT") ||
        message.includes("ECONNRESET"));
}
async function verifyGoogleIdToken(idToken) {
    if (!googleTokenVerifier || !googleClientId) {
        throw new Error("Google OAuth is not configured");
    }
    // Retry once for intermittent network/cert-fetch issues.
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            return await googleTokenVerifier.verifyIdToken({
                idToken,
                audience: googleClientId,
            });
        }
        catch (err) {
            if (attempt === 0 && isTransientNetworkError(err)) {
                await sleep(200);
                continue;
            }
            throw err;
        }
    }
    throw new Error("Google token verification failed");
}
if ((googleClientId || googleClientSecret) && !isGoogleConfigured) {
    // Intentionally do not log secrets.
    console.warn("[auth] Google OAuth is not fully configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to real values (not placeholders), then restart the dev server.");
}
const nextAuthSecret = process.env.NEXTAUTH_SECRET;
if (!nextAuthSecret) {
    throw new Error("NEXTAUTH_SECRET environment variable is required. Generate one with: openssl rand -base64 32");
}
exports.authOptions = {
    debug: process.env.NEXTAUTH_DEBUG === "true",
    logger: {
        error(code, metadata) {
            const error = metadata?.error;
            const safe = {
                name: error?.name,
                message: error?.message,
                cause: {
                    error: error?.cause?.error,
                    error_description: error?.cause?.error_description,
                    message: error?.cause?.message,
                },
            };
            if (process.env.NEXTAUTH_DEBUG === "true") {
                console.error("[next-auth][error]", code, safe);
            }
            else {
                console.error("[next-auth][error]", code);
            }
        },
        warn(code) {
            console.warn("[next-auth][warn]", code);
        },
        debug(code, metadata) {
            if (process.env.NEXTAUTH_DEBUG === "true") {
                console.debug("[next-auth][debug]", code, metadata);
            }
        },
    },
    adapter: prismaIntIdAdapter(),
    providers: [
        ...(isGoogleConfigured
            ? [
                (0, google_1.default)({
                    clientId: googleClientId,
                    clientSecret: googleClientSecret,
                    // If the PKCE code_verifier cookie is lost/mismatched (common in some dev setups),
                    // Google returns invalid_grant at the token exchange step.
                    // Using state-only is sufficient for local dev and avoids that failure mode.
                    checks: ["state"],
                    allowDangerousEmailAccountLinking: true,
                }),
            ]
            : []),
        (0, credentials_1.default)({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Email and password are required");
                }
                const user = await prisma_1.default.user.findUnique({
                    where: { email: credentials.email },
                });
                if (!user) {
                    throw new Error("Invalid email or password");
                }
                // Security: never allow password login for Google-only accounts.
                // A "Google-only" account has no local passwordHash, but does have a linked Google provider account.
                if (!user.passwordHash) {
                    const hasGoogleAccount = (await prisma_1.default.account.count({
                        where: { userId: user.id, provider: "google" },
                    })) > 0;
                    if (hasGoogleAccount) {
                        throw new Error("Email already exists. Please sign in with Google.");
                    }
                    throw new Error("Invalid email or password");
                }
                const isValidPassword = await bcryptjs_1.default.compare(credentials.password, user.passwordHash);
                if (!isValidPassword) {
                    throw new Error("Invalid email or password");
                }
                return {
                    id: user.id.toString(),
                    email: user.email,
                    name: user.name,
                    image: user.image,
                };
            },
        }),
    ],
    callbacks: {
        async session({ session, token, user }) {
            if (!session.user)
                return session;
            // Always set a stable id for our app code.
            session.user.id =
                token.sub || user?.id;
            // With `strategy: "jwt"`, NextAuth will otherwise keep using whatever
            // name/email/image was captured at sign-in time. Hydrate from DB so
            // profile edits (e.g. name) are reflected after refresh.
            const id = Number(token.sub);
            if (Number.isFinite(id)) {
                try {
                    const fresh = await prisma_1.default.user.findUnique({
                        where: { id },
                        select: { name: true, email: true, image: true },
                    });
                    if (fresh) {
                        session.user.name = fresh.name;
                        session.user.email = fresh.email;
                        session.user.image = fresh.image ?? undefined;
                    }
                }
                catch {
                    // If DB is temporarily unavailable, fall back to the token/session values.
                }
            }
            return session;
        },
        async jwt({ token, user }) {
            // IMPORTANT: The JWT is stored in a cookie when `session.strategy = "jwt"`.
            // Never attach `account`, OAuth tokens, profiles, or any large objects here.
            // Keep it minimal to avoid NextAuth's CHUNKING_SESSION_COOKIE and oversized headers.
            const sub = user ? String(user.id) : token.sub;
            const email = (typeof token.email === "string" && token.email) ||
                user?.email;
            const name = (typeof token.name === "string" && token.name) ||
                user?.name;
            // NextAuth uses `picture` for `session.user.image`.
            const picture = (typeof token.picture === "string" &&
                token.picture) ||
                user?.image;
            const safeToken = {
                sub,
                email: email && email.length <= 320 ? email : undefined,
                name: name && name.length <= 256 ? name : undefined,
                picture: picture && picture.length <= 2048 ? picture : undefined,
            };
            if (process.env.NEXTAUTH_DEBUG === "true") {
                const keys = Object.keys(safeToken).filter((k) => safeToken[k] !== undefined);
                const size = JSON.stringify(safeToken).length;
                console.debug("[auth] jwt payload bytes", { size, keys });
            }
            return safeToken;
        },
        async signIn({ user, account, profile }) {
            // If signing in with OAuth and user exists, allow linking
            if (account?.provider === "google") {
                try {
                    // Security: always verify Google ID token server-side.
                    // NextAuth handles the OAuth code exchange, but we still validate the returned id_token.
                    const idToken = account.id_token;
                    if (!idToken) {
                        throw new Error("Missing Google id_token");
                    }
                    const ticket = await verifyGoogleIdToken(idToken);
                    const payload = ticket.getPayload();
                    const googleEmail = payload?.email;
                    const googleSub = payload?.sub;
                    if (!googleEmail || !user.email) {
                        throw new Error("Google token missing email");
                    }
                    if (googleEmail.toLowerCase() !== user.email.toLowerCase()) {
                        throw new Error("Google token email mismatch");
                    }
                    // providerAccountId should be the Google subject. If it exists and doesn't match, reject.
                    if (googleSub &&
                        account.providerAccountId &&
                        String(account.providerAccountId) !== String(googleSub)) {
                        throw new Error("Google token subject mismatch");
                    }
                    const existingUser = await prisma_1.default.user.findUnique({
                        where: { email: user.email },
                    });
                    if (existingUser) {
                        // Update avatar if from Google
                        const googleProfile = profile;
                        if (googleProfile?.picture && !existingUser.image) {
                            await prisma_1.default.user.update({
                                where: { id: existingUser.id },
                                data: { image: googleProfile.picture },
                            });
                        }
                    }
                }
                catch (err) {
                    // Avoid logging secrets/tokens. Provide enough context to diagnose.
                    console.error("[auth] google oauth callback failed", {
                        message: err?.message,
                        code: err?.code,
                        providerAccountId: account?.providerAccountId,
                        hasUserEmail: !!user?.email,
                    });
                    throw err;
                }
            }
            return true;
        },
    },
    pages: {
        signIn: "/login",
        error: "/login",
    },
    session: {
        strategy: "jwt",
        maxAge: 7 * 24 * 60 * 60, // 7 days
    },
    secret: process.env.NEXTAUTH_SECRET,
};
