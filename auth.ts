import NextAuth, { CredentialsSignin } from "next-auth";
import { attemptLogin, buildLoginThrottleKey } from "@/lib/login-rate-limit";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import authConfig from "@/auth.config";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/validations";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

class LoginThrottled extends CredentialsSignin { code = "too_many_attempts"; }
class EmailNotVerified extends CredentialsSignin { code = "email_not_verified"; }

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt(args) {
      const token = authConfig.callbacks.jwt(args);
      if (!token.sub) return null;
      const [user] = await db.select({ sessionVersion: users.sessionVersion, emailVerifiedAt: users.emailVerifiedAt }).from(users)
        .where(eq(users.id, token.sub)).limit(1);
      // Missing claims belong to pre-migration sessions (version zero). Never
      // refresh an old session into the current version after a password reset.
      if (!user?.emailVerifiedAt || (token.sessionVersion ?? 0) !== user.sessionVersion) return null;
      return token;
    }
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {}
      },
      async authorize(rawCredentials) {
        const emailInput = typeof rawCredentials?.email === "string" ? rawCredentials.email.trim().toLowerCase() : "";
        const email = loginSchema.shape.email.safeParse(emailInput);
        const key = buildLoginThrottleKey(email.success && email.data.length <= 254 ? email.data : "malformed", null);
        const result = await attemptLogin(key, async (tx) => {
          const credentials = loginSchema.safeParse({ ...rawCredentials, email: emailInput });
          if (!credentials.success || !email.success || email.data.length > 254) return { error: "credentials" };
          const [user] = await tx.select({
            id: users.id, email: users.email, passwordHash: users.passwordHash,
            sessionVersion: users.sessionVersion, emailVerifiedAt: users.emailVerifiedAt
          }).from(users).where(eq(users.email, credentials.data.email)).limit(1);
          if (!user || !(await verifyPassword(credentials.data.password, user.passwordHash))) return { error: "credentials" };
          // Reveal verification status only after the password has been proven.
          if (!user.emailVerifiedAt) return { error: "email_not_verified" };
          return { user: { id: user.id, email: user.email, sessionVersion: user.sessionVersion } };
        });
        if ("user" in result) return result.user ?? null;
        if (result.error === "too_many_attempts") throw new LoginThrottled();
        if (result.error === "email_not_verified") throw new EmailNotVerified();
        return null;
      }
    })
  ]
});
