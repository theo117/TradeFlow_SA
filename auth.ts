import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import authConfig from "@/auth.config";
import { getKeyFeatureTrialDays } from "@/lib/billing-access";
import { loginSchema } from "@/lib/validations";
import { db } from "@/lib/db";
import { businesses, users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/password";

class EmailNotVerifiedError extends CredentialsSignin {
  code = "email_not_verified";
}

const OAUTH_PASSWORD_HASH_PREFIX = "oauth:";

async function ensureGoogleUser(email: string, name?: string | null) {
  const normalizedEmail = email.toLowerCase();
  const now = new Date().toISOString();

  const [existingUser] = await db
    .select({ id: users.id, emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existingUser) {
    if (!existingUser.emailVerifiedAt) {
      await db
        .update(users)
        .set({ emailVerifiedAt: now })
        .where(eq(users.id, existingUser.id));
    }

    const [business] = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.ownerId, existingUser.id))
      .limit(1);

    if (!business) {
      await db.insert(businesses).values({
        ownerId: existingUser.id,
        name: getGoogleBusinessName(name, normalizedEmail),
        email: normalizedEmail,
        trialEndsAt: new Date(
          Date.now() + getKeyFeatureTrialDays() * 24 * 60 * 60 * 1000
        ).toISOString()
      });
    }

    return existingUser.id;
  }

  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email: normalizedEmail,
        passwordHash: `${OAUTH_PASSWORD_HASH_PREFIX}google`,
        emailVerifiedAt: now
      })
      .returning({ id: users.id });

    await tx.insert(businesses).values({
      ownerId: user.id,
      name: getGoogleBusinessName(name, normalizedEmail),
      email: normalizedEmail,
      trialEndsAt: new Date(
        Date.now() + getKeyFeatureTrialDays() * 24 * 60 * 60 * 1000
      ).toISOString()
    });

    return user.id;
  });
}

function getGoogleBusinessName(name: string | null | undefined, email: string) {
  return name?.trim() || email.split("@")[0] || "My business";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile, user }) {
      if (account?.provider !== "google") {
        return true;
      }

      const email = profile?.email ?? user.email;

      if (!email) {
        return false;
      }

      user.id = await ensureGoogleUser(email, profile?.name ?? user.name);
      user.email = email.toLowerCase();

      return true;
    }
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    }),
    Credentials({
      credentials: {
        email: {},
        password: {}
      },
      async authorize(rawCredentials) {
        const credentials = loginSchema.safeParse(rawCredentials);

        if (!credentials.success) {
          return null;
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.data.email.toLowerCase()))
          .limit(1);

        if (!user) {
          return null;
        }

        if (user.passwordHash.startsWith(OAUTH_PASSWORD_HASH_PREFIX)) {
          return null;
        }

        const isValidPassword = await verifyPassword(
          credentials.data.password,
          user.passwordHash
        );

        if (!isValidPassword) {
          return null;
        }

        if (!user.emailVerifiedAt) {
          throw new EmailNotVerifiedError();
        }

        return {
          id: user.id,
          email: user.email
        };
      }
    })
  ]
});
