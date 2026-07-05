import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import authConfig from "@/auth.config";
import { getKeyFeatureTrialDays } from "@/lib/billing-access";
import { loginSchema } from "@/lib/validations";
import { db } from "@/lib/db";
import { businesses, users } from "@/lib/db/schema";

const HARDCODED_LOGIN = {
  email: "owner@tradeflow.local",
  password: "TradeFlow2026!",
  businessName: "TradeFlow SA"
};

async function ensureHardcodedUser() {
  const email = HARDCODED_LOGIN.email;
  const normalizedEmail = email.toLowerCase();
  const now = new Date().toISOString();

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existingUser) {
    await db
      .update(users)
      .set({ emailVerifiedAt: now })
      .where(eq(users.id, existingUser.id));

    const [business] = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.ownerId, existingUser.id))
      .limit(1);

    if (!business) {
      await db.insert(businesses).values({
        ownerId: existingUser.id,
        name: HARDCODED_LOGIN.businessName,
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
        passwordHash: "hardcoded-login",
        emailVerifiedAt: now
      })
      .returning({ id: users.id });

    await tx.insert(businesses).values({
      ownerId: user.id,
      name: HARDCODED_LOGIN.businessName,
      email: normalizedEmail,
      trialEndsAt: new Date(
        Date.now() + getKeyFeatureTrialDays() * 24 * 60 * 60 * 1000
      ).toISOString()
    });

    return user.id;
  });
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
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

        if (
          credentials.data.email.toLowerCase() !== HARDCODED_LOGIN.email ||
          credentials.data.password !== HARDCODED_LOGIN.password
        ) {
          return null;
        }

        const userId = await ensureHardcodedUser();

        return {
          id: userId,
          email: HARDCODED_LOGIN.email
        };
      }
    })
  ]
});
