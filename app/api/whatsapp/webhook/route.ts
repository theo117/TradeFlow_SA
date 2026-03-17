import { NextRequest, NextResponse } from "next/server";
import {
  handleWhatsappWebhookPayload,
  verifyWhatsappWebhook,
  verifyWhatsappWebhookSignature
} from "@/lib/whatsapp";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (!verifyWhatsappWebhook(mode, token) || !challenge) {
    return new NextResponse("Invalid webhook verification request", {
      status: 403
    });
  }

  return new NextResponse(challenge, { status: 200 });
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWhatsappWebhookSignature({ body, signature })) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const payload = await Promise.resolve().then(() => JSON.parse(body)).catch(() => null);

  if (!payload) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await handleWhatsappWebhookPayload(payload);
  return NextResponse.json({ ok: true });
}
