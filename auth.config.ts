import type { NextAuthConfig } from "next-auth";
import { assertProductionEnv } from "@/lib/env";

assertProductionEnv();

const authConfig = {
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: [],
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login"
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }

      return session;
    }
  }
} satisfies NextAuthConfig;

export default authConfig;
