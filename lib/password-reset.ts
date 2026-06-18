import { createHash, randomBytes } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { passwordResetTokens, users } from "@/lib/db/schema";
import { logInfo } from "@/lib/observability";
import { hashPassword } from "@/lib/password";

const TOKEN_BYTES = 32;
const TOKEN_TTL_HOURS = 1;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getAppUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

  return configuredUrl?.replace(/\/$/, "") ?? "http://localhost:3000";
}

function getEmailProviderConfig() {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;

  if (resendApiKey && emailFrom) {
    return { resendApiKey, emailFrom };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Password reset email is not configured. Set RESEND_API_KEY and EMAIL_FROM."
    );
  }

  return null;
}

export async function createPasswordResetToken(userId: string) {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(
    Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000
  ).toISOString();

  await db.insert(passwordResetTokens).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt
  });

  return {
    token,
    expiresAt,
    url: `${getAppUrl()}/reset-password?token=${encodeURIComponent(token)}`
  };
}

export async function sendPasswordResetEmail({
  email,
  resetUrl
}: {
  email: string;
  resetUrl: string;
}) {
  const emailProvider = getEmailProviderConfig();

  if (!emailProvider) {
    logInfo("Password reset link generated for local development", {
      resetUrl
    });
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${emailProvider.resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: emailProvider.emailFrom,
      to: email,
      subject: "Reset your TradeFlow SA password",
      html: `
        <p>Reset your TradeFlow SA password by opening this link:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link expires in ${TOKEN_TTL_HOURS} hour.</p>
      `
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Password reset email send failed: ${details}`);
  }
}

export async function resetPasswordWithToken({
  token,
  password
}: {
  token: string;
  password: string;
}) {
  const tokenHash = hashToken(token);
  const [resetToken] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt)
      )
    )
    .limit(1);

  if (!resetToken) {
    return { ok: false, reason: "invalid" as const };
  }

  if (new Date(resetToken.expiresAt).getTime() < Date.now()) {
    return { ok: false, reason: "expired" as const };
  }

  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        passwordHash,
        emailVerifiedAt: now
      })
      .where(eq(users.id, resetToken.userId));

    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(passwordResetTokens.userId, resetToken.userId),
          isNull(passwordResetTokens.usedAt)
        )
      );
  });

  return { ok: true, reason: "reset" as const, userId: resetToken.userId };
}
