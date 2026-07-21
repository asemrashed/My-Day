/** Map technical / Auth.js errors to short user-facing messages. */
export function friendlyError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!error) return fallback;

  if (typeof error === "string") {
    return sanitizeMessage(error, fallback);
  }

  const err = error as {
    message?: string;
    type?: string;
    code?: string;
    cause?: { message?: string; err?: { message?: string; code?: string } };
    digest?: string;
  };

  const candidates = [
    err.cause?.err?.message,
    err.cause?.message,
    err.message,
    err.code,
    err.type,
  ].filter(Boolean) as string[];

  for (const msg of candidates) {
    const friendly = sanitizeMessage(msg, "");
    if (friendly) return friendly;
  }

  return fallback;
}

function sanitizeMessage(raw: string, fallback: string): string {
  const msg = raw.trim();
  const lower = msg.toLowerCase();

  if (!msg) return fallback;

  // Auth.js docs URLs / codes
  if (lower.includes("errors.authjs.dev") || lower.includes("callbackrouteerror")) {
    return "Sign-in could not be completed. Please try again in a moment.";
  }
  if (lower.includes("credentialssignin") || lower.includes("credentials signin")) {
    return "Invalid email or password.";
  }
  if (lower.includes("oauthaccountnotlinked")) {
    return "This email is already linked to a different sign-in method.";
  }
  if (lower.includes("accessdenied") || lower.includes("access denied")) {
    return "Access was denied. Please try another sign-in method.";
  }
  if (lower.includes("configuration")) {
    return "Authentication is temporarily unavailable. Please try again later.";
  }

  // SMTP / email
  if (
    lower.includes("smtp") ||
    lower.includes("invalid login") ||
    lower.includes("econnrefused") ||
    (lower.includes("email") && lower.includes("fail"))
  ) {
    return "We couldn't send the email right now. Please try again in a moment.";
  }

  // Prisma / DB
  if (
    lower.includes("findmany") ||
    lower.includes("prisma") ||
    lower.includes("cannot read properties of undefined") ||
    lower.includes("mongodb") ||
    lower.includes("server selection")
  ) {
    return "We're having trouble reaching the server. Please refresh and try again.";
  }

  // Network
  if (lower.includes("fetch failed") || lower.includes("network") || lower.includes("etimedout")) {
    return "Network error. Check your connection and try again.";
  }

  // Never expose stack traces, URLs, or raw exception names to users
  if (
    lower.startsWith("error:") ||
    lower.includes("http://") ||
    lower.includes("https://") ||
    lower.includes("at ") ||
    lower.includes("\n") ||
    msg.length > 160
  ) {
    return fallback;
  }

  return msg;
}
