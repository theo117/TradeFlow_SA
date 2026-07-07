import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import authConfig from "@/auth.config";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/validations";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

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

        const email = credentials.data.email.toLowerCase();
        const [user] = await db
          .select({
            id: users.id,
            email: users.email,
            passwordHash: users.passwordHash
          })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user) {
          return null;
        }

        const passwordMatches = await verifyPassword(
          credentials.data.password,
          user.passwordHash
        );

        if (!passwordMatches) {
          return null;
        }

        return {
          id: user.id,
          email: user.email
        };
      }
    })
  ]
});
