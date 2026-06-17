import { createHash, randomBytes } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailVerificationTokens, users } from "@/lib/db/schema";

const TOKEN_BYTES = 32;
const TOKEN_TTL_HOURS = 24;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getEmailProviderConfig() {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;

  if (resendApiKey && emailFrom) {
    return { resendApiKey, emailFrom };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Email verification is not configured. Set RESEND_API_KEY and EMAIL_FROM."
    );
  }

  return null;
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
  const tokenHash = hashToken(token);
  const [verificationToken] = await db
    .select()
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.tokenHash, tokenHash),
        isNull(emailVerificationTokens.usedAt)
      )
    )
    .limit(1);

  if (!verificationToken) {
    return { ok: false, reason: "invalid" as const };
  }

  if (new Date(verificationToken.expiresAt).getTime() < Date.now()) {
    return { ok: false, reason: "expired" as const };
  }

  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ emailVerifiedAt: now })
      .where(eq(users.id, verificationToken.userId));

    await tx
      .update(emailVerificationTokens)
      .set({ usedAt: now })
      .where(eq(emailVerificationTokens.id, verificationToken.id));
  });

  return { ok: true, reason: "verified" as const };
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
    console.info("Email verification link generated", {
      email,
      verificationUrl
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
