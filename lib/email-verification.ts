import { getEmailProviderConfig } from "@/lib/env";
import { createHash, randomBytes } from "crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailVerificationTokens, users } from "@/lib/db/schema";
import { logInfo } from "@/lib/observability";

const TOKEN_BYTES = 32;
const TOKEN_TTL_HOURS = 24;

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

export async function createEmailVerificationToken(userId: string) {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(
    Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000
  ).toISOString();

  await db.insert(emailVerificationTokens).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt
  });

  return {
    token,
    expiresAt,
    url: `${getAppUrl()}/verify-email?token=${encodeURIComponent(token)}`
  };
}

export async function verifyEmailToken(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { ok: false, reason: "invalid" as const };
  return db.transaction(async (tx) => {
    const [account] = await tx.select({ id: users.id }).from(users)
      .innerJoin(emailVerificationTokens, eq(emailVerificationTokens.userId, users.id))
      .where(eq(emailVerificationTokens.tokenHash, hashToken(token)))
      .for("update", { of: users });
    if (!account) return { ok: false, reason: "invalid" as const };
    const [claimed] = await tx.update(emailVerificationTokens).set({ usedAt: sql`clock_timestamp()` })
      .where(and(eq(emailVerificationTokens.tokenHash, hashToken(token)),
        eq(emailVerificationTokens.userId, account.id), isNull(emailVerificationTokens.usedAt),
        sql`${emailVerificationTokens.expiresAt} > clock_timestamp()`))
      .returning({ userId: emailVerificationTokens.userId });
    if (!claimed) return { ok: false, reason: "invalid" as const };
    await tx.update(users).set({ emailVerifiedAt: sql`clock_timestamp()` })
      .where(and(eq(users.id, claimed.userId), isNull(users.emailVerifiedAt)));
    return { ok: true, reason: "verified" as const };
  });
}

export async function sendEmailVerification({
  email,
  verificationUrl
}: {
  email: string;
  verificationUrl: string;
}) {
  const emailProvider = getEmailProviderConfig();

  if (!emailProvider) {
    logInfo("Email verification email is disabled");
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
      subject: "Confirm your TradeFlow SA email",
      html: `
        <p>Confirm your TradeFlow SA account by opening this link:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p>This link expires in ${TOKEN_TTL_HOURS} hours.</p>
      `
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Email verification send failed: ${details}`);
  }
}
