import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit";
import { db } from "@/lib/db";
import { publicShareTokens } from "@/lib/db/schema";
import { getBaseUrl } from "@/lib/utils";

export type PublicDocumentType = "quote" | "invoice" | "quote-pdf" | "invoice-pdf";

const DEFAULT_PUBLIC_LINK_TTL_HOURS = 24 * 14;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function buildAbsoluteUrl(path: string, token: string) {
  const url = new URL(path, getBaseUrl());
  url.searchParams.set("token", token);
  return url.toString();
}

export async function getOrCreatePublicShareUrl({
  type,
  path,
  businessId,
  quoteId,
  invoiceId,
  createdByUserId,
  ttlHours = Number(process.env.PUBLIC_LINK_TTL_HOURS ?? DEFAULT_PUBLIC_LINK_TTL_HOURS)
}: {
  type: PublicDocumentType;
  path: string;
  businessId: string;
  quoteId?: string | null;
  invoiceId?: string | null;
  createdByUserId?: string | null;
  ttlHours?: number;
}) {
  const token = randomBytes(24).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + Math.max(ttlHours, 1) * 60 * 60 * 1000).toISOString();

  await db.insert(publicShareTokens).values({
    businessId,
    createdByUserId: createdByUserId ?? null,
    documentType: type,
    quoteId: quoteId ?? null,
    invoiceId: invoiceId ?? null,
    tokenHash,
    expiresAt
  });

  await logAuditEvent({
    businessId,
    userId: createdByUserId ?? null,
    action: "share_token.created",
    entityType: type,
    entityId: quoteId ?? invoiceId ?? null,
    metadata: { type, expiresAt }
  });

  return buildAbsoluteUrl(path, token);
}

export async function validatePublicAccessToken({
  type,
  id,
  token
}: {
  type: PublicDocumentType;
  id: string;
  token?: string | null;
}) {
  if (!token) {
    return false;
  }

  const tokenHash = hashToken(token);
  const nowIso = new Date().toISOString();
  const [row] = await db
    .select({ id: publicShareTokens.id, businessId: publicShareTokens.businessId })
    .from(publicShareTokens)
    .where(
      and(
        eq(publicShareTokens.tokenHash, tokenHash),
        eq(publicShareTokens.documentType, type),
        type.startsWith("quote")
          ? eq(publicShareTokens.quoteId, id)
          : eq(publicShareTokens.invoiceId, id),
        isNull(publicShareTokens.revokedAt),
        gt(publicShareTokens.expiresAt, nowIso)
      )
    )
    .limit(1);

  if (!row) {
    return false;
  }

  await db
    .update(publicShareTokens)
    .set({ lastAccessedAt: nowIso })
    .where(eq(publicShareTokens.id, row.id));

  await logAuditEvent({
    businessId: row.businessId,
    action: "share_token.accessed",
    entityType: type,
    entityId: id,
    metadata: { type }
  });

  return true;
}

export async function revokePublicShareTokens({
  businessId,
  documentType,
  documentId,
  revokedByUserId
}: {
  businessId: string;
  documentType: "quote" | "invoice";
  documentId: string;
  revokedByUserId?: string | null;
}) {
  const nowIso = new Date().toISOString();
  const filter =
    documentType === "quote"
      ? and(
          eq(publicShareTokens.businessId, businessId),
          eq(publicShareTokens.quoteId, documentId),
          isNull(publicShareTokens.revokedAt)
        )
      : and(
          eq(publicShareTokens.businessId, businessId),
          eq(publicShareTokens.invoiceId, documentId),
          isNull(publicShareTokens.revokedAt)
        );

  const revoked = await db
    .update(publicShareTokens)
    .set({ revokedAt: nowIso })
    .where(filter)
    .returning({ id: publicShareTokens.id });

  await logAuditEvent({
    businessId,
    userId: revokedByUserId ?? null,
    action: "share_token.revoked",
    entityType: documentType,
    entityId: documentId,
    metadata: { revokedCount: revoked.length }
  });

  return revoked.length;
}
