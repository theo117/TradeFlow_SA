import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import authConfig from "@/auth.config";
import { loginSchema } from "@/lib/validations";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/password";

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

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.data.email.toLowerCase()))
          .limit(1);

        if (!user) {
          return null;
        }

        const isValidPassword = await verifyPassword(
          credentials.data.password,
          user.passwordHash
        );

        if (!isValidPassword) {
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
