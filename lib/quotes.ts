import { getBaseUrl } from "@/lib/utils";

export function getQuotePublicUrl(quoteId: string) {
  return `${getBaseUrl()}/quote/${quoteId}`;
}

export function getQuotePdfUrl(quoteId: string) {
  return `${getBaseUrl()}/api/quotes/${quoteId}/pdf`;
}
