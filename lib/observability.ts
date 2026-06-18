type LogLevel = "info" | "warn" | "error";

type LogMetadata = Record<string, unknown>;

type RequestLike = {
  headers: Headers;
  url?: string;
};

const REDACTED_KEYS = new Set([
  "authorization",
  "cookie",
  "password",
  "passphrase",
  "token",
  "signature",
  "secret",
  "apiKey",
  "api_key",
  "databaseUrl",
  "DATABASE_URL"
]);

export function getRequestLogContext(request: RequestLike) {
  return {
    requestId:
      request.headers.get("x-vercel-id") ??
      request.headers.get("x-request-id") ??
      undefined,
    method: request instanceof Request ? request.method : undefined,
    path: request.url ? new URL(request.url).pathname : undefined
  };
}

export function logInfo(message: string, metadata: LogMetadata = {}) {
  writeLog("info", message, metadata);
}

export function logWarn(message: string, metadata: LogMetadata = {}) {
  writeLog("warn", message, metadata);
}

export function logError(
  message: string,
  error?: unknown,
  metadata: LogMetadata = {}
) {
  writeLog("error", message, {
    ...metadata,
    error: serializeError(error)
  });
}

function writeLog(level: LogLevel, message: string, metadata: LogMetadata) {
  const payload = sanitize({
    level,
    message,
    app: "tradeflow-sa",
    timestamp: new Date().toISOString(),
    ...metadata
  });
  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

function serializeError(error: unknown) {
  if (!error) {
    return undefined;
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack
    };
  }

  return String(error);
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as LogMetadata).map(([key, entry]) => [
      key,
      shouldRedact(key) ? "[redacted]" : sanitize(entry)
    ])
  );
}

function shouldRedact(key: string) {
  if (REDACTED_KEYS.has(key)) {
    return true;
  }

  const normalized = key.toLowerCase();
  return (
    normalized.includes("password") ||
    normalized.includes("secret") ||
    normalized.includes("token") ||
    normalized.includes("signature") ||
    normalized.includes("authorization")
  );
}
