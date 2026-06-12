import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import dns from "dns";
import { OAuth2Client } from "google-auth-library";
import type {
  Adapter,
  AdapterAccount,
  AdapterSession,
  AdapterUser,
  VerificationToken,
} from "next-auth/adapters";

// Some environments resolve Google endpoints to IPv6 first, but IPv6 egress may be blocked.
// This avoids intermittent OAuth callback failures like AggregateError [ETIMEDOUT].
dns.setDefaultResultOrder("ipv4first");

function intUserId(id: string) {
  const value = Number(id);
  if (!Number.isFinite(value)) {
    throw new Error("Invalid user id");
  }
  return value;
}

function toAdapterUser(user: any): AdapterUser {
  return {
    id: String(user.id),
    email: user.email,
    name: user.name,
    image: user.image ?? null,
    emailVerified: user.emailVerified ?? null,
  };
}

function prismaIntIdAdapter(): Adapter {
  return {
    async createUser(data: Omit<AdapterUser, "id">) {
      const created = await prisma.user.create({
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
      const user = await prisma.user.findUnique({
        where: { id: intUserId(id) },
      });
      return user ? toAdapterUser(user) : null;
    },

    async getUserByEmail(email) {
      if (!email) return null;
      const user = await prisma.user.findUnique({ where: { email } });
      return user ? toAdapterUser(user) : null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const account = await prisma.account.findUnique({
        where: { provider_providerAccountId: { provider, providerAccountId } },
        include: { user: true },
      });
      return account?.user ? toAdapterUser(account.user) : null;
    },

    async updateUser(data) {
      const updated = await prisma.user.update({
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
      await prisma.user.delete({ where: { id: intUserId(id) } });
    },

    async linkAccount(account: AdapterAccount) {
      const data = {
        ...account,
        userId: intUserId(account.userId),
      } as any;

      if (data.access_token || data.refresh_token || data.id_token) {
        const { encryptToken } = await import("@/lib/utils/envelopeEncryption");
        if (data.access_token) data.access_token = await encryptToken(data.access_token);
        if (data.refresh_token) data.refresh_token = await encryptToken(data.refresh_token);
        if (data.id_token) data.id_token = await encryptToken(data.id_token);
        data.tokenEncrypted = true;
      }

      await prisma.account.create({ data });
      return account;
    },

    async unlinkAccount({
      provider,
      providerAccountId,
    }: {
      provider: string;
      providerAccountId: string;
    }) {
      await prisma.account.delete({
        where: { provider_providerAccountId: { provider, providerAccountId } },
      });
    },

    async createSession(session) {
      // No-op: with `session.strategy = "jwt"`, database sessions are never
      // read by NextAuth.  Writing them here would produce orphaned rows
      // that accumulate on every credentials sign-in.
      return {
        sessionToken: session.sessionToken,
        userId: session.userId,
        expires: session.expires,
      } satisfies AdapterSession;
    },

    async getSessionAndUser(sessionToken) {
      const session = await prisma.session.findUnique({
        where: { sessionToken },
        include: { user: true },
      });

      if (!session) return null;

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
      const updated = await prisma.session.update({
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
      } satisfies AdapterSession;
    },

    async deleteSession(sessionToken) {
      await prisma.session.delete({ where: { sessionToken } });
    },

    async createVerificationToken(token) {
      const created = await prisma.verificationToken.create({
        data: token,
      });
      return created as VerificationToken;
    },

    async useVerificationToken(token) {
      try {
        const deleted = await prisma.verificationToken.delete({
          where: {
            identifier_token: {
              identifier: token.identifier,
              token: token.token,
            },
          },
        });
        return deleted as VerificationToken;
      } catch {
        return null;
      }
    },
  };
}

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

const looksLikePlaceholder = (value: string | undefined) => {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "your-client-secret" ||
    normalized === "your-google-client-secret" ||
    normalized === "your-google-client-id.apps.googleusercontent.com" ||
    normalized.startsWith("your-")
  );
};

const isGoogleConfigured =
  !!googleClientId &&
  !!googleClientSecret &&
  !looksLikePlaceholder(googleClientId) &&
  !looksLikePlaceholder(googleClientSecret);

const googleTokenVerifier = isGoogleConfigured
  ? new OAuth2Client({ clientId: googleClientId! })
  : null;

const githubClientId = process.env.GITHUB_ID;
const githubClientSecret = process.env.GITHUB_SECRET;

const isGithubConfigured =
  !!githubClientId &&
  !!githubClientSecret &&
  !looksLikePlaceholder(githubClientId) &&
  !looksLikePlaceholder(githubClientSecret);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientNetworkError(error: unknown) {
  const anyErr = error as any;
  const code = anyErr?.code as string | undefined;
  const message = (anyErr?.message as string | undefined) || "";

  return (
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "EAI_AGAIN" ||
    code === "ENOTFOUND" ||
    message.includes("ETIMEDOUT") ||
    message.includes("ECONNRESET")
  );
}

async function verifyGoogleIdToken(idToken: string) {
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
    } catch (err) {
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
  console.warn(
    "[auth] Google OAuth is not fully configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to real values (not placeholders), then restart the dev server.",
  );
}

if ((githubClientId || githubClientSecret) && !isGithubConfigured) {
  console.warn(
    "[auth] GitHub OAuth is not fully configured. Set GITHUB_ID and GITHUB_SECRET to real values (not placeholders), then restart the dev server.",
  );
}

// NextAuth secret is resolved lazily at runtime

if (process.env.NODE_ENV === "production" && !process.env.NEXTAUTH_URL) {
  console.warn(
    "[auth][warning] NEXTAUTH_URL environment variable is not set in production. " +
      "This will likely cause Google OAuth 'redirect_uri_mismatch' errors because the " +
      "callback URL cannot be reliably inferred. Please set NEXTAUTH_URL to your exact production domain (e.g., https://yourdomain.com).",
  );
}

const tokenVersionCache = new Map<
  string,
  { version: number; fetchedAt: number }
>();
const CACHE_TTL_MS = 60_000;

async function getFreshTokenVersion(
  sub: string | undefined,
  fallback: number | undefined,
): Promise<number | undefined> {
  if (!sub) return fallback;
  const userId = Number(sub);
  if (!Number.isFinite(userId)) return fallback;

  const cached = tokenVersionCache.get(sub);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.version;
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { tokenVersion: true },
    });
    if (dbUser) {
      tokenVersionCache.set(sub, {
        version: dbUser.tokenVersion,
        fetchedAt: Date.now(),
      });
      return dbUser.tokenVersion;
    }
  } catch {
    // DB unavailable — use the existing token version from the JWT cookie
  }
  return fallback;
}

// Pre-computed dummy hash for timing-safe comparison.
// Generated via bcrypt.hashSync("dummy", 10) - must be exactly 60 characters.
const DUMMY_BCRYPT_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMy.MqrqZR2r0Y2ILi7z1tPzC6mXi7TE7.K";

export const authOptions: NextAuthOptions = {
  debug: process.env.NEXTAUTH_DEBUG === "true",
  logger: {
    error(code, metadata) {
      const error = (metadata as any)?.error;
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
      } else {
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
          GoogleProvider({
            clientId: googleClientId!,
            clientSecret: googleClientSecret!,
            // If the PKCE code_verifier cookie is lost/mismatched (common in some dev setups),
            // Google returns invalid_grant at the token exchange step.
            // Using state-only is sufficient for local dev and avoids that failure mode.
            checks: ["state"],
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    ...(isGithubConfigured
      ? [
          GitHubProvider({
            clientId: githubClientId!,
            clientSecret: githubClientSecret!,
            authorization: {
              params: {
                scope: "read:user user:email repo",
              },
            },
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        // To prevent timing attacks, always run bcrypt.compare with a dummy hash if user/hash is missing.
        const passwordHashToCompare = user?.passwordHash || DUMMY_BCRYPT_HASH;
        const isValidPassword = await bcrypt.compare(
          credentials.password,
          passwordHashToCompare,
        );

        if (!user || !user.passwordHash || !isValidPassword) {
          if (!user) {
            console.info(
              `[auth-config] Credentials login failed: User not found for email ${credentials.email}`,
            );
          } else if (!user.passwordHash) {
            console.info(
              `[auth-config] Credentials login failed: User ${user.id} has no password hash`,
            );
          } else {
            console.info(
              `[auth-config] Credentials login failed: Incorrect password for user ${user.id}`,
            );
          }
          throw new Error("Invalid email or password");
        }

        return {
          id: user.id.toString(),
          email: user.email,
          name: user.name,
          image: (user as any).image,
        };
      },
    }),
  ],
  callbacks: {
    async session({ session, token, user }) {
      if (!session.user) return session;

      // Always set a stable id for our app code.
      (session.user as any).id =
        (token.sub as string | undefined) || (user as any)?.id;

      // With `strategy: "jwt"`, NextAuth will otherwise keep using whatever
      // name/email/image was captured at sign-in time. Hydrate from DB so
      // profile edits (e.g. name) are reflected after refresh.
      const id = Number(token.sub);
      if (Number.isFinite(id)) {
        try {
          const fresh = await prisma.user.findUnique({
            where: { id },
            select: {
              name: true,
              email: true,
              image: true,
              tokenVersion: true,
            },
          });

          if (fresh) {
            session.user.name = fresh.name;
            session.user.email = fresh.email;
            session.user.image = fresh.image ?? undefined;

            // Validate tokenVersion: if the JWT tokenVersion doesn't match
            // the DB, the session has been invalidated (password change/logout).
            const jwtTokenVersion = (token as any).tokenVersion as
              | number
              | undefined;
            if (
              jwtTokenVersion != null &&
              fresh.tokenVersion !== jwtTokenVersion
            ) {
              return {
                ...session,
                user: { id: (session.user as any).id },
                expires: new Date(0).toISOString(),
              } as any;
            }
          }
        } catch {
          // If DB is temporarily unavailable, fall back to the token/session values.
        }
      }

      return session;
    },
    async jwt({ token, user }) {
      // IMPORTANT: The JWT is stored in a cookie when `session.strategy = "jwt"`.
      // Never attach `account`, OAuth tokens, profiles, or any large objects here.
      // Keep it minimal to avoid NextAuth's CHUNKING_SESSION_COOKIE and oversized headers.

      const sub = user ? String((user as any).id) : token.sub;

      const email =
        (typeof token.email === "string" && token.email) ||
        ((user as any)?.email as string | undefined);

      const name =
        (typeof token.name === "string" && token.name) ||
        ((user as any)?.name as string | undefined);

      // NextAuth uses `picture` for `session.user.image`.
      const picture =
        (typeof (token as any).picture === "string" &&
          (token as any).picture) ||
        ((user as any)?.image as string | undefined);

      // Attach tokenVersion for session invalidation on password change/logout.
      // Always fetch from DB on every JWT callback invocation so that logout
      // or password change is reflected within one token refresh cycle (~5 min).
      // Cache the DB lookup for 60 seconds to avoid excessive queries.
      const tokenVersion = await getFreshTokenVersion(
        user ? String((user as any).id) : token.sub,
        (token as any).tokenVersion as number | undefined,
      );

      const safeToken: Record<string, unknown> = {
        sub,
        email: email && email.length <= 320 ? email : undefined,
        name: name && name.length <= 256 ? name : undefined,
        picture: picture && picture.length <= 2048 ? picture : undefined,
        tokenVersion,
      };

      if (process.env.NEXTAUTH_DEBUG === "true") {
        const keys = Object.keys(safeToken).filter(
          (k) => safeToken[k] !== undefined,
        );
        const size = JSON.stringify(safeToken).length;
        console.debug("[auth] jwt payload bytes", { size, keys });
      }

      return safeToken as any;
    },
    async signIn({ user, account, profile }) {
      // If signing in with OAuth and user exists, allow linking
      if (account?.provider === "google") {
        try {
          // Security: always verify Google ID token server-side.
          // NextAuth handles the OAuth code exchange, but we still validate the returned id_token.
          const idToken = (account as any).id_token as string | undefined;
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
          if (
            googleSub &&
            account.providerAccountId &&
            String(account.providerAccountId) !== String(googleSub)
          ) {
            throw new Error("Google token subject mismatch");
          }

          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! },
          });

          if (existingUser) {
            // Update avatar if from Google
            const googleProfile = profile as { picture?: string } | undefined;
            if (googleProfile?.picture && !(existingUser as any).image) {
              await prisma.user.update({
                where: { id: existingUser.id },
                data: { image: googleProfile.picture },
              });
            }
          }
        } catch (err: any) {
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
  // secret is injected lazily at route level
};
