import { createClient } from "npm:@supabase/supabase-js@2";

const responseHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Vary": "Origin",
};

type EnquiryItem = {
  slug: string;
  name: string;
  category: string;
  quantity: number;
};

type EnquiryInput = {
  request_type: "contact" | "quote";
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  project_details: string | null;
  items: EnquiryItem[];
  consent: true;
  website_url?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const productSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const originAllowlist = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

function getBackendSecretKey(): string | null {
  const legacyKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacyKey) {
    return legacyKey;
  }

  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!secretKeys) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(secretKeys);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      console.error("Supabase did not provide its secret keys in the expected format.");
      return null;
    }
    const defaultKey = (parsed as Record<string, unknown>).default;
    return typeof defaultKey === "string" && defaultKey.length > 0 ? defaultKey : null;
  } catch {
    console.error("Supabase did not provide valid JSON secret keys.");
    return null;
  }
}

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  origin?: string,
): Response {
  const headers: Record<string, string> = { ...responseHeaders };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "authorization, apikey, content-type, x-client-info";
    headers["Access-Control-Max-Age"] = "600";
  }
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
}

class PayloadTooLargeError extends Error {
  constructor() {
    super("The enquiry is too large to submit.");
  }
}

async function readJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) {
    throw new Error("The enquiry request had no body.");
  }

  const chunks: Uint8Array[] = [];
  let byteCount = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      byteCount += value.byteLength;
      if (byteCount > 24_000) {
        await reader.cancel();
        throw new PayloadTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const contents = new Uint8Array(byteCount);
  let offset = 0;
  for (const chunk of chunks) {
    contents.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(contents));
}

function sanitiseText(value: unknown, maximumLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const text = value
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  if (text.length < 1 || text.length > maximumLength) {
    return null;
  }
  return text;
}

function parseItems(value: unknown): EnquiryItem[] | null {
  if (!Array.isArray(value) || value.length > 40) {
    return null;
  }
  const items: EnquiryItem[] = [];
  const slugs = new Set<string>();

  for (const entry of value) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      return null;
    }
    const candidate = entry as Record<string, unknown>;
    if (
      typeof candidate.slug !== "string"
      || !productSlugPattern.test(candidate.slug)
      || !sanitiseText(candidate.name, 160)
      || !sanitiseText(candidate.category, 80)
      || !Number.isSafeInteger(candidate.quantity)
      || (candidate.quantity as number) < 1
      || (candidate.quantity as number) > 100_000_000
      || slugs.has(candidate.slug)
    ) {
      return null;
    }
    slugs.add(candidate.slug);
    items.push({
      slug: candidate.slug,
      name: sanitiseText(candidate.name, 160)!,
      category: sanitiseText(candidate.category, 80)!,
      quantity: candidate.quantity as number,
    });
  }
  return items;
}

function parseEnquiry(value: unknown): EnquiryInput | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const input = value as Record<string, unknown>;
  const requestType = input.request_type;
  const name = sanitiseText(input.name, 120);
  const email = sanitiseText(input.email, 254)?.toLowerCase() ?? null;
  const rawPhone = input.phone === "" || input.phone === null || input.phone === undefined
    ? null
    : sanitiseText(input.phone, 40);
  const subject = sanitiseText(input.subject, 120);
  const rawMessage = input.message === undefined || input.message === null
    ? ""
    : input.message;
  const message = typeof rawMessage === "string"
    ? rawMessage.normalize("NFKC")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .trim()
    : null;
  const rawProject = input.project_details === "" || input.project_details === null ||
      input.project_details === undefined
    ? null
    : sanitiseText(input.project_details, 3000);
  const items = parseItems(input.items ?? []);

  if (
    (requestType !== "contact" && requestType !== "quote")
    || !name
    || name.length < 2
    || !email
    || email.length > 254
    || !emailPattern.test(email)
    || (input.phone && !rawPhone)
    || (input.project_details && !rawProject)
    || !subject
    || subject.length < 2
    || message === null
    || message.length > 5000
    || (requestType === "contact" && message.length < 10)
    || (requestType === "quote" && message.length === 0 && !rawProject)
    || !items
    || (requestType === "quote" && items.length === 0)
    || (requestType === "contact" && items.length !== 0)
    || input.consent !== true
  ) {
    return null;
  }

  return {
    request_type: requestType,
    name,
    email,
    phone: rawPhone,
    subject,
    message: message || "Product quotation request.",
    project_details: rawProject,
    items,
    consent: true,
    website_url: typeof input.website_url === "string" ? input.website_url.slice(0, 500) : "",
  };
}

async function hashRequester(
  ip: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(ip));
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (request: Request): Promise<Response> => {
  const origin = request.headers.get("origin");
  const allowedOrigin = origin
    ? originAllowlist.find((candidate) => candidate === origin.replace(/\/+$/, ""))
    : undefined;

  if (!allowedOrigin) {
    return jsonResponse(403, { error: "This website is not allowed to submit enquiries." });
  }
  if (request.method === "OPTIONS") {
    return jsonResponse(204, {}, allowedOrigin);
  }
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Use POST to submit an enquiry." }, allowedOrigin);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonResponse(415, { error: "Submit your enquiry using the website form." }, allowedOrigin);
  }
  if ((Number(request.headers.get("content-length")) || 0) > 24_000) {
    return jsonResponse(413, { error: "The enquiry is too large to submit." }, allowedOrigin);
  }

  let input: unknown;
  try {
    input = await readJson(request);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return jsonResponse(413, { error: error.message }, allowedOrigin);
    }
    return jsonResponse(400, { error: "Enter your enquiry details and try again." }, allowedOrigin);
  }

  const enquiry = parseEnquiry(input);
  if (!enquiry) {
    return jsonResponse(400, { error: "Some enquiry details are missing or invalid. Please review the form and try again." }, allowedOrigin);
  }
  if (enquiry.website_url) {
    return jsonResponse(200, { success: true }, allowedOrigin);
  }

  const backendUrl = Deno.env.get("SUPABASE_URL");
  const backendSecretKey = getBackendSecretKey();
  const rateLimitSecret = Deno.env.get("RATE_LIMIT_SECRET");
  if (!backendUrl || !backendSecretKey || !rateLimitSecret || originAllowlist.length === 0) {
    console.error("Missing required submit-enquiry Supabase or origin configuration.");
    return jsonResponse(503, { error: "The enquiry service is not ready yet. Please try again later or call our team." }, allowedOrigin);
  }
  if (rateLimitSecret.length < 32) {
    console.error("RATE_LIMIT_SECRET must contain at least 32 characters.");
    return jsonResponse(503, { error: "The enquiry service is not ready yet. Please try again later or call our team." }, allowedOrigin);
  }

  const requesterIp = request.headers.get("cf-connecting-ip");
  if (!requesterIp || requesterIp.length > 64) {
    console.error("The trusted proxy did not provide a usable client IP.");
    return jsonResponse(503, { error: "The enquiry service could not verify this request. Please call our team." }, allowedOrigin);
  }

  try {
    const requesterHash = await hashRequester(requesterIp, rateLimitSecret);
    const supabase = createClient(backendUrl, backendSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.rpc("submit_public_enquiry", {
      p_request: enquiry,
      p_requester_hash: requesterHash,
    });

    if (data?.rate_limited === true) {
      return jsonResponse(429, { error: "Too many enquiries have been submitted from your connection. Please try again in a little while." }, allowedOrigin);
    }
    if (error) {
      console.error("The database rejected an enquiry:", error.code);
      return jsonResponse(500, { error: "We couldn't save your enquiry just now. Your details have not been submitted; please try again or call our team." }, allowedOrigin);
    }

    return jsonResponse(201, {
      success: true,
      reference: typeof data?.reference === "string" ? data.reference : undefined,
    }, allowedOrigin);
  } catch (error) {
    console.error("Could not store an enquiry:", error);
    return jsonResponse(500, { error: "We couldn't save your enquiry just now. Your details have not been submitted; please try again or call our team." }, allowedOrigin);
  }
});
