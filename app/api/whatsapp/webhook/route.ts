import { NextRequest, NextResponse } from "next/server";
import {
  handleWhatsappWebhookPayload,
  verifyWhatsappWebhook,
  verifyWhatsappWebhookSignature
} from "@/lib/whatsapp";
import {
  getRequestLogContext,
  logError,
  logInfo,
  logWarn
} from "@/lib/observability";
import { buildRateLimitKey, consumeRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const requestContext = getRequestLogContext(request);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const limit = await consumeRateLimit({
    namespace: "webhook.whatsapp.verify",
    key: buildRateLimitKey("whatsapp-verify", [ip]),
    limit: 60,
    windowMs: 15 * 60 * 1000
  });

  if (limit.blocked) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: {
        "Retry-After": String(limit.retryAfterSeconds ?? 900)
      }
    });
  }
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (!verifyWhatsappWebhook(mode, token) || !challenge) {
    logWarn("WhatsApp webhook verification rejected", {
      ...requestContext,
      mode,
      ms: Date.now() - startedAt
    });
    return new NextResponse("Invalid webhook verification request", {
      status: 403
    });
  }

  logInfo("WhatsApp webhook verified", {
    ...requestContext,
    mode,
    ms: Date.now() - startedAt
  });
  return new NextResponse(challenge, { status: 200 });
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const requestContext = getRequestLogContext(request);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const limit = await consumeRateLimit({
    namespace: "webhook.whatsapp.post",
    key: buildRateLimitKey("whatsapp-post", [ip]),
    limit: 120,
    windowMs: 15 * 60 * 1000
  });

  if (limit.blocked) {
    return NextResponse.json(
      { ok: false },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfterSeconds ?? 900)
        }
      }
    );
  }
  const body = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWhatsappWebhookSignature({ body, signature })) {
    logWarn("WhatsApp webhook signature rejected", {
      ...requestContext,
      bodyBytes: body.length,
      ms: Date.now() - startedAt
    });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const payload = await Promise.resolve().then(() => JSON.parse(body)).catch(() => null);

  if (!payload) {
    logWarn("WhatsApp webhook payload invalid", {
      ...requestContext,
      bodyBytes: body.length,
      ms: Date.now() - startedAt
    });
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    await handleWhatsappWebhookPayload(payload);
    logInfo("WhatsApp webhook processed", {
      ...requestContext,
      bodyBytes: body.length,
      ms: Date.now() - startedAt
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("WhatsApp webhook processing failed", error, {
      ...requestContext,
      bodyBytes: body.length,
      ms: Date.now() - startedAt
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
