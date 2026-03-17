import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { businesses, customers } from "@/lib/db/schema";
import { getOrCreatePublicShareUrl } from "@/lib/public-access";
import { logActivityEvent } from "@/lib/activity";
import { currency } from "@/lib/utils";

const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION ?? "v23.0";
const GRAPH_API_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const DEFAULT_LANGUAGE_CODE = process.env.WHATSAPP_TEMPLATE_LANGUAGE_CODE ?? "en";

export type WhatsappDeliveryState =
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

type InvoiceWhatsappPayload = {
  invoiceId: string;
  invoiceNumber: string;
  total: number;
  dueDate: string;
  reminder: boolean;
  business: {
    id: string;
    name: string;
    whatsapp_phone_number_id: string | null;
  };
  customer: {
    id: string;
    name: string;
    phone: string | null;
    whatsapp_phone: string | null;
    whatsapp_opt_in: boolean;
  };
};

type QuoteWhatsappPayload = {
  quoteId: string;
  quoteReference: string;
  total: number;
  business: {
    id: string;
    name: string;
    whatsapp_phone_number_id: string | null;
  };
  customer: {
    id: string;
    name: string;
    phone: string | null;
    whatsapp_phone: string | null;
    whatsapp_opt_in: boolean;
  };
};

type CallbackData = {
  kind: "invoice" | "quote";
  businessId: string;
  customerId: string;
} & (
  | {
      kind: "invoice";
      invoiceId: string;
      reminder: boolean;
    }
  | {
      kind: "quote";
      quoteId: string;
    }
);

export function normalizeWhatsappPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("27")) {
    return digits;
  }

  if (digits.startsWith("0")) {
    return `27${digits.slice(1)}`;
  }

  return digits;
}

export function resolveCustomerWhatsappPhone(customer: {
  whatsapp_phone?: string | null;
  phone?: string | null;
}) {
  const phone = customer.whatsapp_phone || customer.phone;
  return phone ? normalizeWhatsappPhone(phone) : null;
}

export function getInvoicePublicWhatsappUrl(invoiceId: string, businessId: string) {
  return getOrCreatePublicShareUrl({
    type: "invoice",
    businessId,
    invoiceId,
    path: `/invoice/${invoiceId}`
  });
}

export function isWhatsappCloudConfigured() {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN);
}

function getTemplateName(reminder: boolean) {
  return reminder
    ? process.env.WHATSAPP_TEMPLATE_INVOICE_REMINDER_NAME
    : process.env.WHATSAPP_TEMPLATE_INVOICE_NAME;
}

function getQuoteTemplateName() {
  return process.env.WHATSAPP_TEMPLATE_QUOTE_NAME;
}

function buildCallbackData(payload: CallbackData) {
  return JSON.stringify(payload);
}

function parseCallbackData(value?: string | null): CallbackData | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    if (
      parsed &&
      (parsed.kind === "invoice" || parsed.kind === "quote") &&
      typeof parsed.businessId === "string" &&
      typeof parsed.customerId === "string"
    ) {
      if (
        parsed.kind === "invoice" &&
        typeof parsed.invoiceId === "string" &&
        typeof parsed.reminder === "boolean"
      ) {
        return parsed as CallbackData;
      }

      if (parsed.kind === "quote" && typeof parsed.quoteId === "string") {
        return parsed as CallbackData;
      }
    }
  } catch {}

  return null;
}

export function verifyWhatsappWebhook(mode?: string | null, token?: string | null) {
  return Boolean(
    mode === "subscribe" &&
      token &&
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN &&
      token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  );
}

export function verifyWhatsappWebhookSignature({
  body,
  signature
}: {
  body: string;
  signature?: string | null;
}) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (!appSecret || !signature?.startsWith("sha256=")) {
    return false;
  }

  const expected = `sha256=${createHmac("sha256", appSecret).update(body).digest("hex")}`;
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);

  return left.length === right.length && timingSafeEqual(left, right);
}

export async function sendInvoiceWhatsappMessage(payload: InvoiceWhatsappPayload) {
  if (!isWhatsappCloudConfigured()) {
    return {
      ok: false as const,
      message:
        "WhatsApp Cloud API is not configured. Add the access token and template names first.",
      delivery: "manual" as const
    };
  }

  if (!payload.business.whatsapp_phone_number_id) {
    return {
      ok: false as const,
      message: "Business WhatsApp phone number ID is missing in settings.",
      delivery: "manual" as const
    };
  }

  if (!payload.customer.whatsapp_opt_in) {
    return {
      ok: false as const,
      message: "Customer has not opted in to WhatsApp updates.",
      delivery: "manual" as const
    };
  }

  const recipientPhone = resolveCustomerWhatsappPhone(payload.customer);
  if (!recipientPhone) {
    return {
      ok: false as const,
      message: "Customer does not have a WhatsApp phone number.",
      delivery: "manual" as const
    };
  }

  const templateName = getTemplateName(payload.reminder);
  if (!templateName) {
    return {
      ok: false as const,
      message: "WhatsApp template name is missing from environment configuration.",
      delivery: "manual" as const
    };
  }

  const response = await fetch(
    `${GRAPH_API_BASE_URL}/${payload.business.whatsapp_phone_number_id}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: DEFAULT_LANGUAGE_CODE
          },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: payload.customer.name },
                { type: "text", text: payload.business.name },
                { type: "text", text: payload.invoiceNumber },
                { type: "text", text: currency(payload.total) },
                { type: "text", text: payload.dueDate },
                {
                  type: "text",
                  text: await getInvoicePublicWhatsappUrl(
                    payload.invoiceId,
                    payload.business.id
                  )
                }
              ]
            }
          ]
        },
        biz_opaque_callback_data: buildCallbackData({
          kind: "invoice",
          businessId: payload.business.id,
          customerId: payload.customer.id,
          invoiceId: payload.invoiceId,
          reminder: payload.reminder
        })
      })
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false as const,
      message:
        data?.error?.message || "Meta rejected the WhatsApp message request.",
      delivery: "cloud" as const
    };
  }

  const messageId = data?.messages?.[0]?.id as string | undefined;
  await logActivityEvent({
    businessId: payload.business.id,
    customerId: payload.customer.id,
    invoiceId: payload.invoiceId,
    type: payload.reminder ? "invoice.whatsapp_reminder_sent" : "invoice.whatsapp_sent",
    channel: "whatsapp",
    description: messageId
      ? `WhatsApp ${payload.reminder ? "reminder" : "message"} queued with Meta message ID ${messageId}.`
      : `WhatsApp ${payload.reminder ? "reminder" : "message"} queued.`
  });

  return {
    ok: true as const,
    message: payload.reminder
      ? "Invoice WhatsApp reminder queued"
      : "Invoice WhatsApp message queued",
    delivery: "cloud" as const
  };
}

export async function sendQuoteWhatsappMessage(payload: QuoteWhatsappPayload) {
  if (!isWhatsappCloudConfigured()) {
    return {
      ok: false as const,
      message:
        "WhatsApp Cloud API is not configured. Add the access token and template names first.",
      delivery: "manual" as const
    };
  }

  if (!payload.business.whatsapp_phone_number_id) {
    return {
      ok: false as const,
      message: "Business WhatsApp phone number ID is missing in settings.",
      delivery: "manual" as const
    };
  }

  if (!payload.customer.whatsapp_opt_in) {
    return {
      ok: false as const,
      message: "Customer has not opted in to WhatsApp updates.",
      delivery: "manual" as const
    };
  }

  const recipientPhone = resolveCustomerWhatsappPhone(payload.customer);
  if (!recipientPhone) {
    return {
      ok: false as const,
      message: "Customer does not have a WhatsApp phone number.",
      delivery: "manual" as const
    };
  }

  const templateName = getQuoteTemplateName();
  if (!templateName) {
    return {
      ok: false as const,
      message: "WhatsApp quote template name is missing from environment configuration.",
      delivery: "manual" as const
    };
  }

  const response = await fetch(
    `${GRAPH_API_BASE_URL}/${payload.business.whatsapp_phone_number_id}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: DEFAULT_LANGUAGE_CODE
          },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: payload.customer.name },
                { type: "text", text: payload.business.name },
                { type: "text", text: payload.quoteReference },
                { type: "text", text: currency(payload.total) },
                {
                  type: "text",
                  text: await getOrCreatePublicShareUrl({
                    type: "quote",
                    businessId: payload.business.id,
                    quoteId: payload.quoteId,
                    path: `/quote/${payload.quoteId}`
                  })
                }
              ]
            }
          ]
        },
        biz_opaque_callback_data: buildCallbackData({
          kind: "quote",
          businessId: payload.business.id,
          customerId: payload.customer.id,
          quoteId: payload.quoteId
        })
      })
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false as const,
      message:
        data?.error?.message || "Meta rejected the WhatsApp message request.",
      delivery: "cloud" as const
    };
  }

  const messageId = data?.messages?.[0]?.id as string | undefined;
  await logActivityEvent({
    businessId: payload.business.id,
    customerId: payload.customer.id,
    quoteId: payload.quoteId,
    type: "quote.whatsapp_sent",
    channel: "whatsapp",
    description: messageId
      ? `WhatsApp quote queued with Meta message ID ${messageId}.`
      : "WhatsApp quote queued."
  });

  return {
    ok: true as const,
    message: "Quote WhatsApp message queued",
    delivery: "cloud" as const
  };
}

export async function handleWhatsappWebhookPayload(payload: unknown) {
  const entries = Array.isArray((payload as { entry?: unknown[] })?.entry)
    ? ((payload as { entry: unknown[] }).entry ?? [])
    : [];

  for (const entry of entries) {
    const changes = Array.isArray((entry as { changes?: unknown[] })?.changes)
      ? ((entry as { changes: unknown[] }).changes ?? [])
      : [];

    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> })?.value;
      if (!value) {
        continue;
      }

      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      for (const rawStatus of statuses) {
        const status = rawStatus as Record<string, unknown>;
        const callback = parseCallbackData(
          typeof status.biz_opaque_callback_data === "string"
            ? status.biz_opaque_callback_data
            : null
        );

        if (!callback) {
          continue;
        }

        const statusLabel =
          typeof status.status === "string" ? status.status : "updated";
        const errorTitle = Array.isArray(status.errors)
          ? (status.errors[0] as { title?: string })?.title
          : null;

        await logActivityEvent({
          businessId: callback.businessId,
          customerId: callback.customerId,
          invoiceId: callback.kind === "invoice" ? callback.invoiceId : null,
          quoteId: callback.kind === "quote" ? callback.quoteId : null,
          type:
            callback.kind === "invoice"
              ? "invoice.whatsapp_status"
              : "quote.whatsapp_status",
          channel: "whatsapp",
          description: errorTitle
            ? `WhatsApp status changed to ${statusLabel}: ${errorTitle}.`
            : `WhatsApp status changed to ${statusLabel}.`
        });
      }

      const messages = Array.isArray(value.messages) ? value.messages : [];
      const metadata = value.metadata as Record<string, unknown> | undefined;
      const phoneNumberId =
        typeof metadata?.phone_number_id === "string"
          ? metadata.phone_number_id
          : null;

      for (const rawMessage of messages) {
        const message = rawMessage as Record<string, unknown>;
        const from = typeof message.from === "string" ? message.from : null;
        if (!phoneNumberId || !from) {
          continue;
        }

        const [business] = await db
          .select({ id: businesses.id })
          .from(businesses)
          .where(eq(businesses.whatsappPhoneNumberId, phoneNumberId))
          .limit(1);

        if (!business) {
          continue;
        }

        const [customer] = await db
          .select({ id: customers.id })
          .from(customers)
          .where(
            and(
              eq(customers.businessId, business.id),
              or(eq(customers.whatsappPhone, from), eq(customers.phone, from))
            )
          )
          .limit(1);

        const textBody =
          (message.text as { body?: string } | undefined)?.body ??
          "Customer replied on WhatsApp.";

        await logActivityEvent({
          businessId: business.id,
          customerId: customer?.id ?? null,
          type: "whatsapp.inbound",
          channel: "whatsapp",
          description: `Incoming WhatsApp message: ${textBody}`
        });
      }
    }
  }
}

export function parseWhatsappDeliveryState(
  type: string,
  description: string
): WhatsappDeliveryState | null {
  if (type.endsWith(".whatsapp_sent") || type.endsWith(".whatsapp_reminder_sent")) {
    return "queued";
  }

  if (!type.endsWith(".whatsapp_status")) {
    return null;
  }

  const normalized = description.toLowerCase();

  if (normalized.includes(" read")) {
    return "read";
  }

  if (normalized.includes(" delivered")) {
    return "delivered";
  }

  if (normalized.includes(" sent")) {
    return "sent";
  }

  if (
    normalized.includes(" failed") ||
    normalized.includes(" undeliverable") ||
    normalized.includes(" error")
  ) {
    return "failed";
  }

  return null;
}
