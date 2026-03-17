"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { eq } from "drizzle-orm";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { businesses, users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/password";
import { loginSchema, registerSchema } from "@/lib/validations";

export async function login(formData: FormData) {
  const payload = loginSchema.parse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  try {
    await signIn("credentials", {
      email: payload.email.toLowerCase(),
      password: payload.password,
      redirectTo: "/dashboard"
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=Invalid%20email%20or%20password");
    }

    throw error;
  }
}

export async function register(formData: FormData) {
  const payload = registerSchema.parse({
    businessName: formData.get("businessName"),
    email: formData.get("email"),
    password: formData.get("password")
  });

  const email = payload.email.toLowerCase();
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser) {
    redirect("/register?error=An%20account%20with%20that%20email%20already%20exists");
  }

  const passwordHash = await hashPassword(payload.password);

  await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email,
        passwordHash
      })
      .returning({ id: users.id });

    await tx.insert(businesses).values({
      ownerId: user.id,
      name: payload.businessName
    });
  });

  await signIn("credentials", {
    email,
    password: payload.password,
    redirectTo: "/dashboard"
  });
}

export async function logout() {
  await signOut({
    redirectTo: "/login"
  });
}
