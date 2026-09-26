// Existing PostgreSQL numeric(12, 2) and integer storage limits.
export const MAX_QUOTE_CENTS = 999_999_999_999;
export const MAX_QUOTE_QUANTITY = 2_147_483_647;

export function quoteMoneyToCents(value: string | number): number {
  const decimal = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(decimal)) {
    throw new Error("Quote amounts must be non-negative with at most two decimal places.");
  }
  const [whole, fraction = ""] = decimal.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > MAX_QUOTE_CENTS) {
    throw new Error("Quote amount exceeds the supported monetary limit.");
  }
  return cents;
}

export function quoteCentsToDecimal(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > MAX_QUOTE_CENTS) {
    throw new Error("Quote amount exceeds the supported monetary limit.");
  }
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export function sumQuoteCents(values: number[]): number {
  return values.reduce((sum, value) => {
    // Validate before addition so every arithmetic operation stays exactly representable.
    quoteCentsToDecimal(value);
    if (value > MAX_QUOTE_CENTS - sum) {
      throw new Error("Quote total exceeds the supported monetary limit.");
    }
    return sum + value;
  }, 0);
}
