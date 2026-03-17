import { currency } from "@/lib/utils";

function buildMailtoUrl({
  to,
  subject,
  body
}: {
  to: string;
  subject: string;
  body: string;
}) {
  const params = new URLSearchParams({
    subject,
    body
  });

  return `mailto:${encodeURIComponent(to)}?${params.toString()}`;
}

export function buildInvoiceEmailUrl({
  email,
  customerName,
  invoiceNumber,
  businessName,
  total,
  invoiceUrl,
  pdfUrl
}: {
  email: string;
  customerName: string;
  invoiceNumber: string;
  businessName: string;
  total: number;
  invoiceUrl: string;
  pdfUrl: string;
}) {
  const body = [
    `Hello ${customerName},`,
    "",
    `Your invoice ${invoiceNumber} from ${businessName} is ready.`,
    `Amount due: ${currency(total)}`,
    "",
    `View online: ${invoiceUrl}`,
    `Download PDF: ${pdfUrl}`,
    "",
    "Thank you."
  ].join("\n");

  return buildMailtoUrl({
    to: email,
    subject: `Invoice ${invoiceNumber} from ${businessName}`,
    body
  });
}

export function buildInvoiceReminderEmailUrl({
  email,
  customerName,
  invoiceNumber,
  businessName,
  total,
  invoiceUrl,
  pdfUrl
}: {
  email: string;
  customerName: string;
  invoiceNumber: string;
  businessName: string;
  total: number;
  invoiceUrl: string;
  pdfUrl: string;
}) {
  const body = [
    `Hello ${customerName},`,
    "",
    `This is a reminder that invoice ${invoiceNumber} from ${businessName} is still outstanding.`,
    `Amount due: ${currency(total)}`,
    "",
    `View online: ${invoiceUrl}`,
    `Download PDF: ${pdfUrl}`,
    "",
    "Thank you."
  ].join("\n");

  return buildMailtoUrl({
    to: email,
    subject: `Reminder: invoice ${invoiceNumber} from ${businessName}`,
    body
  });
}

export function buildQuoteEmailUrl({
  email,
  customerName,
  quoteReference,
  businessName,
  total,
  quoteUrl,
  pdfUrl
}: {
  email: string;
  customerName: string;
  quoteReference: string;
  businessName: string;
  total: number;
  quoteUrl: string;
  pdfUrl: string;
}) {
  const body = [
    `Hello ${customerName},`,
    "",
    `Please find your quote ${quoteReference} from ${businessName}.`,
    `Quoted total: ${currency(total)}`,
    "",
    `View online: ${quoteUrl}`,
    `Download PDF: ${pdfUrl}`,
    "",
    "If you would like any changes, please reply to this email.",
    "",
    "Thank you."
  ].join("\n");

  return buildMailtoUrl({
    to: email,
    subject: `Quote ${quoteReference} from ${businessName}`,
    body
  });
}
