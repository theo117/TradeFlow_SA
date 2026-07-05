"use server";

import { cookies, headers } from "next/headers";
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
  createPasswordResetToken,
  resetPasswordWithToken,
  sendPasswordResetEmail
} from "@/lib/password-reset";
import {
  buildLoginThrottleKey,
  clearFailedLogin,
  isLoginBlocked,
  recordFailedLogin
} from "@/lib/login-rate-limit";
import { buildRateLimitKey, consumeRateLimit } from "@/lib/rate-limit";
import { hashPassword } from "@/lib/password";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema
} from "@/lib/validations";
import { getKeyFeatureTrialDays } from "@/lib/auth";

function isRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

function getClientIp(headerStore: Headers) {
  const forwardedFor = headerStore.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() ?? null;
}

async function enforceAnonymousActionLimit({
  action,
  ip,
  email,
  redirectTo
}: {
  action: string;
  ip: string | null;
  email?: string | null;
  redirectTo: string;
}) {
  const result = await consumeRateLimit({
    namespace: `auth.${action}`,
    key: buildRateLimitKey(action, [ip, email?.toLowerCase() ?? null]),
    limit: 5,
    windowMs: 15 * 60 * 1000,
    blockMs: 15 * 60 * 1000
  });

  if (result.blocked) {
    logWarn("Anonymous auth action blocked by rate limit", {
      action,
      ip,
      retryAfterSeconds: result.retryAfterSeconds
    });
    redirect(redirectTo);
  }
}

async function clearAuthSessionCookies() {
  const cookieStore = await cookies();
  const sessionCookiePrefixes = [
    "authjs.session-token",
    "__Secure-authjs.session-token"
  ];

  for (const cookie of cookieStore.getAll()) {
    if (sessionCookiePrefixes.some((prefix) => cookie.name.startsWith(prefix))) {
      cookieStore.delete(cookie.name);
    }
  }
}

export async function login(formData: FormData) {
  const startedAt = Date.now();
  const redirectTo = normalizeRedirectTarget(formData.get("next"));
  const headerStore = await headers();
  const ip = getClientIp(headerStore);

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
    await clearAuthSessionCookies();
    const headerStore = await headers();
    const forwardedFor = headerStore.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() ?? null;
    const payload = registerSchema.parse({
      businessName: formData.get("businessName"),
      email: formData.get("email"),
      password: formData.get("password")
    });

    const email = payload.email.toLowerCase();
    await enforceAnonymousActionLimit({
      action: "register",
      ip,
      email,
      redirectTo:
        "/register?error=Too%20many%20registration%20attempts.%20Please%20wait%2015%20minutes."
    });
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
        email,
        trialEndsAt: new Date(
          Date.now() + getKeyFeatureTrialDays() * 24 * 60 * 60 * 1000
        ).toISOString()
      });

      return user.id;
    });

    const verification = await createEmailVerificationToken(userId);
    let verificationEmailSent = true;

    try {
      await sendEmailVerification({
        email,
        verificationUrl: verification.url
      });
    } catch (error) {
      verificationEmailSent = false;
      logError("Email verification send failed during registration", error, {
        userId,
        ip,
        ms: Date.now() - startedAt
      });
      await logAuditEvent({
        action: "auth.email_verification_send_failed",
        entityType: "user",
        entityId: userId,
        userId,
        ip,
        metadata: {
          reason: error instanceof Error ? error.message : String(error)
        }
      });
    }

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

    const verifyParams = new URLSearchParams({
      email
    });

    if (verificationEmailSent) {
      verifyParams.set("sent", "1");
    } else {
      verifyParams.set(
        "error",
        "We created your account, but could not send the confirmation email. Please try resending it in a minute or contact support."
      );
    }

    redirect(`/verify-email?${verifyParams.toString()}`);
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

export async function resendEmailVerification(formData: FormData) {
  const startedAt = Date.now();
  const headerStore = await headers();
  const ip = getClientIp(headerStore);

  try {
    const payload = forgotPasswordSchema.parse({
      email: formData.get("email")
    });
    const email = payload.email.toLowerCase();
    await enforceAnonymousActionLimit({
      action: "verify-email-resend",
      ip,
      email,
      redirectTo:
        "/verify-email?error=Too%20many%20confirmation%20email%20requests.%20Please%20wait%2015%20minutes."
    });
    const [user] = await db
      .select({ id: users.id, emailVerifiedAt: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user && !user.emailVerifiedAt) {
      const verification = await createEmailVerificationToken(user.id);
      try {
        await sendEmailVerification({
          email,
          verificationUrl: verification.url
        });
      } catch (error) {
        logError("Email verification resend provider failed", error, {
          userId: user.id,
          ip,
          ms: Date.now() - startedAt
        });
        await logAuditEvent({
          userId: user.id,
          action: "auth.email_verification_resend_failed",
          entityType: "user",
          entityId: user.id,
          ip,
          metadata: {
            reason: error instanceof Error ? error.message : String(error)
          }
        });
        redirect(
          `/verify-email?email=${encodeURIComponent(email)}&error=${encodeURIComponent(
            "The email provider rejected the send request. Please check the email service configuration and try again."
          )}`
        );
      }

      await logAuditEvent({
        userId: user.id,
        action: "auth.email_verification_resent",
        entityType: "user",
        entityId: user.id,
        ip
      });
    }

    logInfo("Email verification resend requested", {
      matchedUser: Boolean(user),
      alreadyVerified: Boolean(user?.emailVerifiedAt),
      ip,
      ms: Date.now() - startedAt
    });

    redirect(`/verify-email?sent=1&email=${encodeURIComponent(email)}`);
  } catch (error) {
    if (error instanceof ZodError) {
      logWarn("Email verification resend validation failed", {
        ip,
        ms: Date.now() - startedAt
      });
      redirect("/verify-email?error=Please%20enter%20a%20valid%20email");
    }

    if (!isRedirectError(error)) {
      logError("Email verification resend failed", error, {
        ip,
        ms: Date.now() - startedAt
      });
    }
    throw error;
  }
}

export async function requestPasswordReset(formData: FormData) {
  const startedAt = Date.now();
  const headerStore = await headers();
  const ip = getClientIp(headerStore);

  try {
    const payload = forgotPasswordSchema.parse({
      email: formData.get("email")
    });
    const email = payload.email.toLowerCase();
    await enforceAnonymousActionLimit({
      action: "password-reset-request",
      ip,
      email,
      redirectTo: "/forgot-password?sent=1"
    });
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user) {
      const reset = await createPasswordResetToken(user.id);
      await sendPasswordResetEmail({
        email,
        resetUrl: reset.url
      });

      await logAuditEvent({
        userId: user.id,
        action: "auth.password_reset_requested",
        entityType: "user",
        entityId: user.id,
        ip
      });
    }

    logInfo("Password reset requested", {
      matchedUser: Boolean(user),
      ip,
      ms: Date.now() - startedAt
    });

    redirect("/forgot-password?sent=1");
  } catch (error) {
    if (error instanceof ZodError) {
      logWarn("Password reset request validation failed", {
        ip,
        ms: Date.now() - startedAt
      });
      redirect("/forgot-password?error=Please%20enter%20a%20valid%20email");
    }

    if (!isRedirectError(error)) {
      logError("Password reset request failed", error, {
        ip,
        ms: Date.now() - startedAt
      });
    }
    throw error;
  }
}

export async function resetPassword(formData: FormData) {
  const startedAt = Date.now();
  const rawToken = String(formData.get("token") ?? "");
  const headerStore = await headers();
  const ip = getClientIp(headerStore);

  try {
    const payload = resetPasswordSchema.parse({
      token: formData.get("token"),
      password: formData.get("password")
    });
    await enforceAnonymousActionLimit({
      action: "password-reset-submit",
      ip,
      email: rawToken.slice(0, 12),
      redirectTo:
        "/reset-password?error=Too%20many%20reset%20attempts.%20Please%20request%20a%20new%20link."
    });
    const result = await resetPasswordWithToken(payload);

    if (!result.ok) {
      logWarn("Password reset token rejected", {
        reason: result.reason,
        ip,
        ms: Date.now() - startedAt
      });
      redirect(`/reset-password?error=${encodeURIComponent(
        result.reason === "expired"
          ? "This reset link has expired. Please request a new one."
          : "This reset link is invalid. Please request a new one."
      )}`);
    }

    await logAuditEvent({
      userId: result.userId,
      action: "auth.password_reset_completed",
      entityType: "user",
      entityId: result.userId,
      ip
    });

    logInfo("Password reset completed", {
      userId: result.userId,
      ip,
      ms: Date.now() - startedAt
    });

    redirect("/login?success=Password%20updated.%20You%20can%20log%20in%20now.");
  } catch (error) {
    if (error instanceof ZodError) {
      logWarn("Password reset validation failed", {
        ip,
        ms: Date.now() - startedAt
      });
      const url = new URLSearchParams({
        error: "Please enter a new password with at least 10 characters"
      });

      if (rawToken) {
        url.set("token", rawToken);
      }

      redirect(`/reset-password?${url.toString()}`);
    }

    if (!isRedirectError(error)) {
      logError("Password reset failed", error, {
        ip,
        ms: Date.now() - startedAt
      });
    }
    throw error;
  }
}
