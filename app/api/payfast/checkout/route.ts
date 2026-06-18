import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import {
  createPayfastSignature,
  getPayfastConfig,
  getPlanAmount,
  getPlanLabel,
  type BillingPlan
} from "@/lib/payfast";
import { getBaseUrl } from "@/lib/utils";

export const runtime = "nodejs";

function parsePlan(value: string | null): BillingPlan | null {
  if (value === "starter" || value === "pro") {
    return value;
  }

  return null;
}

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.ownerId, session.user.id))
    .limit(1);

  if (!business) {
    return NextResponse.redirect(new URL("/register", request.url));
  }

  const url = new URL(request.url);
  const plan = parsePlan(url.searchParams.get("plan"));

  if (!plan) {
    return NextResponse.redirect(
      new URL("/dashboard/billing?error=Invalid%20plan", request.url)
    );
  }

  const { merchantId, merchantKey, passphrase, processUrl } = getPayfastConfig();
  const baseUrl = getBaseUrl();
  const paymentId = `${business.id}:${plan}:${Date.now()}`;
  const amount = getPlanAmount(plan);
  const itemName = `${getPlanLabel(plan)} plan`;

  const fields = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: `${baseUrl}/dashboard/billing?success=Payment%20received`,
    cancel_url: `${baseUrl}/dashboard/billing?error=Payment%20cancelled`,
    notify_url: `${baseUrl}/api/payfast/notify`,
    name_first: business.name,
    email_address: business.email ?? session.user.email ?? "",
    m_payment_id: paymentId,
    amount,
    item_name: itemName,
    item_description: `${itemName} access for TradeFlow SA`,
    subscription_type: "1",
    billing_date: new Date().toISOString().slice(0, 10),
    recurring_amount: amount,
    frequency: "3",
    cycles: "0",
    custom_str1: business.id,
    custom_str2: plan
  };

  const signature = createPayfastSignature(fields, passphrase);
  const formInputs = Object.entries({
    ...fields,
    signature
  })
    .map(
      ([key, value]) =>
        `<input type="hidden" name="${key}" value="${String(value).replace(/"/g, "&quot;")}" />`
    )
    .join("");

  const html = `<!doctype html>
<html>
  <body>
    <form id="payfast-form" action="${processUrl}" method="post">
      ${formInputs}
    </form>
    <script>document.getElementById('payfast-form').submit();</script>
  </body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8"
    }
  });
}
