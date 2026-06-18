"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";
import { signIn, signOut } from "@/auth";
import { normalizeRedirectTarget } from "@/lib/workflows";
import { db } from "@/lib/db";
import { businesses, users } from "@/lib/db/schema";
import { logAuditEvent } from "@/lib/audit";
import {
  createEmailVerificationToken,
  sendEmailVerification
} from "@/lib/email-verification";
import { logError, logInfo, logWarn } from "@/lib/observability";
import {
  buildLoginThrottleKey,
  clearFailedLogin,
  isLoginBlocked,
  recordFailedLogin
} from "@/lib/login-rate-limit";
import { hashPassword } from "@/lib/password";
import { loginSchema, registerSchema } from "@/lib/validations";

function isRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

export async function login(formData: FormData) {
  const startedAt = Date.now();
  const redirectTo = normalizeRedirectTarget(formData.get("next"));
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? null;

  try {
    const payload = loginSchema.parse({
      email: formData.get("email"),
      password: formData.get("password")
    });
    const email = payload.email.toLowerCase();
    const throttleKey = buildLoginThrottleKey(email, ip);

    if (await isLoginBlocked(throttleKey)) {
      await logAuditEvent({
        action: "auth.login_blocked",
        entityType: "user",
        entityId: email,
        ip,
        metadata: { email }
      });
      logWarn("Login blocked by rate limit", {
        ip,
        redirectTo,
        ms: Date.now() - startedAt
      });
      redirect("/login?error=Too%20many%20login%20attempts.%20Please%20wait%2015%20minutes.");
    }

    await signIn("credentials", {
      email,
      password: payload.password,
      redirectTo
    });

    await clearFailedLogin(throttleKey);
    await logAuditEvent({
      action: "auth.login_succeeded",
      entityType: "user",
      entityId: email,
      ip,
      metadata: { email }
    });
    logInfo("Login succeeded", {
      ip,
      redirectTo,
      ms: Date.now() - startedAt
    });

    redirect(redirectTo);
  } catch (error) {
    if (error instanceof AuthError) {
      const email = String(formData.get("email") ?? "").trim().toLowerCase();
      if (email) {
        await recordFailedLogin(buildLoginThrottleKey(email, ip));
        await logAuditEvent({
          action: "auth.login_failed",
          entityType: "user",
          entityId: email,
          ip,
          metadata: { email }
        });
      }
      logWarn("Login failed", {
        ip,
        redirectTo,
        ms: Date.now() - startedAt
      });
      redirect("/login?error=The%20email%20or%20password%20does%20not%20match.%20Please%20check%20your%20password%20and%20try%20again.");
    }
    if (error instanceof ZodError) {
      logWarn("Login validation failed", {
        ip,
        redirectTo,
        ms: Date.now() - startedAt
      });
      redirect("/login?error=Please%20enter%20a%20valid%20email%20and%20password");
    }

    throw error;
  }
}

export async function register(formData: FormData) {
  const startedAt = Date.now();
  try {
    const headerStore = await headers();
    const forwardedFor = headerStore.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() ?? null;
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

    const userId = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email,
          passwordHash
        })
        .returning({ id: users.id });

      await tx.insert(businesses).values({
        ownerId: user.id,
        name: payload.businessName,
        email
      });

      return user.id;
    });

    const verification = await createEmailVerificationToken(userId);
    await sendEmailVerification({
      email,
      verificationUrl: verification.url
    });

    await logAuditEvent({
      action: "auth.register_pending_email_verification",
      entityType: "user",
      entityId: email,
      ip,
      metadata: { businessName: payload.businessName, email }
    });
    logInfo("Registration created pending email verification", {
      ip,
      userId,
      ms: Date.now() - startedAt
    });

    redirect(`/verify-email?sent=1&email=${encodeURIComponent(email)}`);
  } catch (error) {
    if (error instanceof AuthError) {
      logWarn("Registration auto-login failed", {
        ms: Date.now() - startedAt
      });
      redirect("/login?error=Unable%20to%20log%20in%20after%20registration");
    }
    if (error instanceof ZodError) {
      logWarn("Registration validation failed", {
        ms: Date.now() - startedAt
      });
      redirect("/register?error=Please%20complete%20all%20required%20fields");
    }

    if (!isRedirectError(error)) {
      logError("Registration failed", error, {
        ms: Date.now() - startedAt
      });
    }
    throw error;
  }
}

export async function logout() {
  await signOut({
    redirectTo: "/login"
  });
}
