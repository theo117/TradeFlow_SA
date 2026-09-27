import { getEmailProviderConfig } from "@/lib/env";
import { createHash, randomBytes } from "crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
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
    logInfo("Password reset email is disabled");
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
  return db.transaction(async (tx) => {
    // Serialize resets for an account before claiming any token. This also
    // prevents competing tokens from deadlocking when all are invalidated.
    const [account] = await tx.select({ id: users.id }).from(users)
      .innerJoin(passwordResetTokens, eq(passwordResetTokens.userId, users.id))
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .for("update", { of: users });
    if (!account) return { ok: false, reason: "invalid" as const };

    // Eligibility is checked at claim time, including after any lock wait.
    // clock_timestamp() does not freeze at the transaction's start time.
    const [claimed] = await tx.update(passwordResetTokens)
      .set({ usedAt: sql`clock_timestamp()` })
      .where(and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        eq(passwordResetTokens.userId, account.id),
        isNull(passwordResetTokens.usedAt),
        sql`${passwordResetTokens.expiresAt} >= clock_timestamp()`
      ))
      .returning({ userId: passwordResetTokens.userId, usedAt: passwordResetTokens.usedAt });

    if (!claimed) {
      const [candidate] = await tx.select({
        usedAt: passwordResetTokens.usedAt,
        expired: sql<boolean>`${passwordResetTokens.expiresAt} < clock_timestamp()`
      }).from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash));
      return { ok: false, reason: candidate && !candidate.usedAt && candidate.expired ? "expired" as const : "invalid" as const };
    }

    const passwordHash = await hashPassword(password);
    await tx.update(users).set({
      passwordHash,
      sessionVersion: sql`${users.sessionVersion} + 1`
    }).where(eq(users.id, claimed.userId));

    // Preserve the existing policy: successful recovery invalidates this user's
    // other unused recovery tokens too, without affecting another account.
    await tx.update(passwordResetTokens).set({ usedAt: claimed.usedAt })
      .where(and(eq(passwordResetTokens.userId, claimed.userId), isNull(passwordResetTokens.usedAt)));

    return { ok: true, reason: "reset" as const, userId: claimed.userId };
  });
}
