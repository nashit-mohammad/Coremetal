import { createClient } from "npm:@supabase/supabase-js@2";

const responseHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Vary": "Origin",
};
const originAllowlist = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const statuses = new Set(["open", "contacted", "closed"]);

type DashboardUser = {
  email: string;
  role: "admin" | "staff";
  must_change_password: boolean;
  expires_at?: string;
};

function getBackendSecretKey(): string | null {
  const legacyKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacyKey) return legacyKey;

  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!secretKeys) return null;
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
    headers["Access-Control-Allow-Headers"] =
      "authorization, apikey, content-type, x-client-info";
    headers["Access-Control-Max-Age"] = "600";
  }
  return new Response(status === 204 ? null : JSON.stringify(body), {status, headers});
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let byteCount = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      byteCount += value.byteLength;
      if (byteCount > 32_000) {
        await reader.cancel();
        return null;
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
  try {
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(contents));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function validPassword(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 14
    && value.length <= 72
    && new TextEncoder().encode(value).byteLength <= 72;
}

function validEmail(value: unknown): value is string {
  return typeof value === "string"
    && value.length <= 254
    && emailPattern.test(value.trim());
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([0-9a-f]{64})$/i.exec(authorization);
  return match?.[1]?.toLowerCase() ?? null;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {name: "HMAC", hash: "SHA-256"},
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function matchesSecret(provided: string, expected: string): boolean {
  const left = new TextEncoder().encode(provided);
  const right = new TextEncoder().encode(expected);
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

Deno.serve(async (request: Request): Promise<Response> => {
  const requestOrigin = request.headers.get("origin");
  const origin = requestOrigin
    ? originAllowlist.find((candidate) => candidate === requestOrigin.replace(/\/+$/, ""))
    : undefined;
  if (!origin) {
    return jsonResponse(403, {error: "This website is not allowed to access the staff dashboard."});
  }
  if (request.method === "OPTIONS") return jsonResponse(204, {}, origin);
  if (request.method !== "POST") {
    return jsonResponse(405, {error: "Use POST to access the staff dashboard."}, origin);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonResponse(415, {error: "Use the staff dashboard form to send this request."}, origin);
  }

  const backendUrl = Deno.env.get("SUPABASE_URL");
  const backendSecretKey = getBackendSecretKey();
  if (!backendUrl || !backendSecretKey || originAllowlist.length === 0) {
    console.error("Missing required Coremetal dashboard backend or origin configuration.");
    return jsonResponse(503, {error: "The staff dashboard is not configured yet."}, origin);
  }

  const body = await readJson(request);
  if (!body || typeof body.action !== "string") {
    return jsonResponse(400, {error: "The dashboard request is invalid."}, origin);
  }

  const supabase = createClient(backendUrl, backendSecretKey, {
    auth: {persistSession: false, autoRefreshToken: false},
  });
  const reportFailure = (operation: string, error: {code?: string; message?: string}) => {
    console.error(`${operation} failed:`, error.code ?? error.message ?? "unknown error");
    return jsonResponse(500, {error: "The request could not be completed. Please try again."}, origin);
  };

  if (body.action === "bootstrap-status") {
    const {data, error} = await supabase.rpc("dashboard_is_initialized");
    if (error) return reportFailure("Dashboard setup check", error);
    return jsonResponse(200, {initialized: data === true}, origin);
  }

  if (body.action === "bootstrap") {
    const bootstrapSecret = Deno.env.get("DASHBOARD_BOOTSTRAP_SECRET") ?? "";
    const configuredEmails = (Deno.env.get("DASHBOARD_ADMIN_EMAILS") ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    const submittedAdmins = body.admins;
    if (
      bootstrapSecret.length < 32
      || configuredEmails.length !== 3
      || !Array.isArray(submittedAdmins)
      || submittedAdmins.length !== 3
      || typeof body.bootstrapSecret !== "string"
      || !matchesSecret(body.bootstrapSecret, bootstrapSecret)
    ) {
      return jsonResponse(403, {error: "Initial administrator setup could not be authorized."}, origin);
    }

    const admins: {email: string; password: string}[] = [];
    for (const submitted of submittedAdmins) {
      if (typeof submitted !== "object" || submitted === null || Array.isArray(submitted)) {
        return jsonResponse(400, {error: "Enter all three administrator accounts."}, origin);
      }
      const candidate = submitted as Record<string, unknown>;
      if (!validEmail(candidate.email) || !validPassword(candidate.password)) {
        return jsonResponse(400, {error: "Use valid emails and passwords of at least 14 characters."}, origin);
      }
      admins.push({email: candidate.email.trim().toLowerCase(), password: candidate.password});
    }
    const expectedEmails = new Set(configuredEmails);
    const submittedEmails = new Set(admins.map((admin) => admin.email));
    if (
      expectedEmails.size !== 3
      || submittedEmails.size !== 3
      || [...expectedEmails].some((email) => !emailPattern.test(email))
      || [...expectedEmails].some((email) => !submittedEmails.has(email))
    ) {
      return jsonResponse(400, {
        error: "The email addresses must match the three administrators configured for initial setup.",
      }, origin);
    }

    const {data, error} = await supabase.rpc("bootstrap_dashboard_admins", {
      p_admins: admins,
    });
    if (error) {
      if (error.code === "42501") {
        return jsonResponse(409, {error: "The staff dashboard has already been initialized."}, origin);
      }
      if (error.code === "23505") {
        return jsonResponse(409, {error: "An administrator account already exists."}, origin);
      }
      return reportFailure("Administrator setup", error);
    }
    return jsonResponse(201, {success: true, administrators: data}, origin);
  }

  if (body.action === "login") {
    if (!validEmail(body.email) || typeof body.password !== "string" || body.password.length > 72) {
      return jsonResponse(400, {error: "Enter your work email and password."}, origin);
    }
    const ip = request.headers.get("cf-connecting-ip");
    const rateLimitSecret = Deno.env.get("RATE_LIMIT_SECRET") ?? "";
    if (!ip || ip.length > 64 || rateLimitSecret.length < 32) {
      console.error("Dashboard sign-in is missing its trusted rate-limit configuration.");
      return jsonResponse(503, {error: "Sign-in is temporarily unavailable."}, origin);
    }

    const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
    const token = [...tokenBytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const [tokenHash, emailAttemptHash, ipAttemptHash] = await Promise.all([
      sha256(token),
      hmacSha256(`email:${body.email.trim().toLowerCase()}`, rateLimitSecret),
      hmacSha256(`ip:${ip}`, rateLimitSecret),
    ]);
    const {data, error} = await supabase.rpc("authenticate_dashboard_user", {
      p_email: body.email.trim().toLowerCase(),
      p_password: body.password,
      p_token_hash: tokenHash,
      p_email_attempt_hash: emailAttemptHash,
      p_ip_attempt_hash: ipAttemptHash,
    });
    if (error) return reportFailure("Dashboard sign-in", error);
    if (data?.rate_limited === true) {
      return jsonResponse(429, {error: "Too many sign-in attempts. Wait 15 minutes and try again."}, origin);
    }
    if (!data || typeof data.email !== "string") {
      return jsonResponse(401, {error: "The email or password is incorrect."}, origin);
    }
    return jsonResponse(200, {token, user: data}, origin);
  }

  const token = bearerToken(request);
  if (!token) return jsonResponse(401, {error: "Sign in to access the staff dashboard."}, origin);
  const tokenHash = await sha256(token);

  if (body.action === "logout") {
    const {error} = await supabase.rpc("revoke_dashboard_session", {
      p_token_hash: tokenHash,
    });
    if (error) return reportFailure("Dashboard sign-out", error);
    return jsonResponse(200, {success: true}, origin);
  }

  const {data: user, error: userError} = await supabase.rpc("get_dashboard_user", {
    p_token_hash: tokenHash,
  });
  if (userError) return reportFailure("Dashboard session validation", userError);
  if (!user || typeof user.email !== "string") {
    return jsonResponse(401, {error: "Your session has expired. Sign in again."}, origin);
  }
  if (body.action === "session") {
    return jsonResponse(200, {user}, origin);
  }
  if (user.must_change_password && body.action !== "change-password") {
    return jsonResponse(403, {error: "Change your initial password before continuing.", mustChangePassword: true}, origin);
  }

  if (body.action === "change-password") {
    if (!validPassword(body.newPassword)) {
      return jsonResponse(400, {error: "Choose a password or passphrase between 14 and 72 characters."}, origin);
    }
    const currentPassword = body.currentPassword === undefined
      ? null
      : typeof body.currentPassword === "string" ? body.currentPassword : "";
    const {data, error} = await supabase.rpc("change_dashboard_password", {
      p_token_hash: tokenHash,
      p_current_password: currentPassword,
      p_new_password: body.newPassword,
    });
    if (error) return reportFailure("Password change", error);
    if (data !== true) {
      return jsonResponse(400, {error: "Your current password is incorrect or your session has expired."}, origin);
    }
    return jsonResponse(200, {success: true}, origin);
  }

  if (body.action === "list-enquiries") {
    const {data, error} = await supabase.rpc("list_dashboard_enquiries", {
      p_token_hash: tokenHash,
    });
    if (error) return reportFailure("Enquiry list", error);
    return jsonResponse(200, {enquiries: data}, origin);
  }

  if (body.action === "update-status") {
    if (
      typeof body.enquiryId !== "string"
      || !uuidPattern.test(body.enquiryId)
      || typeof body.status !== "string"
      || !statuses.has(body.status)
    ) {
      return jsonResponse(400, {error: "Choose a valid enquiry and status."}, origin);
    }
    const {data, error} = await supabase.rpc("update_enquiry_status", {
      p_token_hash: tokenHash,
      p_enquiry_id: body.enquiryId,
      p_new_status: body.status,
    });
    if (error) {
      if (error.code === "P0002") {
        return jsonResponse(404, {error: "That enquiry could not be found."}, origin);
      }
      return reportFailure("Enquiry status update", error);
    }
    return jsonResponse(200, {enquiry: data}, origin);
  }

  if (body.action === "list-users") {
    if (user.role !== "admin") {
      return jsonResponse(403, {error: "Administrator access is required."}, origin);
    }
    const {data, error} = await supabase.rpc("list_dashboard_users", {
      p_token_hash: tokenHash,
    });
    if (error) return reportFailure("Staff list", error);
    return jsonResponse(200, {users: data}, origin);
  }

  if (body.action === "create-user") {
    if (user.role !== "admin") {
      return jsonResponse(403, {error: "Administrator access is required."}, origin);
    }
    if (
      !validEmail(body.email)
      || !validPassword(body.password)
      || (body.role !== "admin" && body.role !== "staff")
    ) {
      return jsonResponse(400, {error: "Enter a valid email, role, and initial password between 14 and 72 characters."}, origin);
    }
    const {data, error} = await supabase.rpc("create_dashboard_user", {
      p_token_hash: tokenHash,
      p_email: body.email.trim().toLowerCase(),
      p_password: body.password,
      p_role: body.role,
    });
    if (error) {
      if (error.code === "23505") {
        return jsonResponse(409, {error: "An account with that email already exists."}, origin);
      }
      return reportFailure("Staff account creation", error);
    }
    return jsonResponse(201, {user: data}, origin);
  }

  if (body.action === "reset-user-password") {
    if (user.role !== "admin") {
      return jsonResponse(403, {error: "Administrator access is required."}, origin);
    }
    if (typeof body.userId !== "string" || !uuidPattern.test(body.userId) || !validPassword(body.password)) {
      return jsonResponse(400, {error: "Choose a valid account and an initial password between 14 and 72 characters."}, origin);
    }
    const {data, error} = await supabase.rpc("reset_dashboard_user_password", {
      p_token_hash: tokenHash,
      p_user_id: body.userId,
      p_new_password: body.password,
    });
    if (error) {
      if (error.code === "P0002") {
        return jsonResponse(404, {error: "That staff account could not be found."}, origin);
      }
      return reportFailure("Staff password reset", error);
    }
    if (data !== true) return jsonResponse(400, {error: "The password could not be reset."}, origin);
    return jsonResponse(200, {success: true}, origin);
  }

  if (body.action === "set-user-active") {
    if (user.role !== "admin") {
      return jsonResponse(403, {error: "Administrator access is required."}, origin);
    }
    if (
      typeof body.userId !== "string"
      || !uuidPattern.test(body.userId)
      || typeof body.active !== "boolean"
    ) {
      return jsonResponse(400, {error: "Choose a valid staff account and access state."}, origin);
    }
    const {data, error} = await supabase.rpc("set_dashboard_user_active", {
      p_token_hash: tokenHash,
      p_user_id: body.userId,
      p_is_active: body.active,
    });
    if (error) {
      if (error.code === "P0002") {
        return jsonResponse(404, {error: "That staff account could not be found."}, origin);
      }
      if (error.code === "22023") {
        return jsonResponse(400, {
          error: error.message === "Administrators cannot disable their own account."
            ? error.message
            : "At least one active administrator must remain.",
        }, origin);
      }
      return reportFailure("Staff access update", error);
    }
    if (data !== true) return jsonResponse(400, {error: "The account access could not be changed."}, origin);
    return jsonResponse(200, {success: true}, origin);
  }

  return jsonResponse(400, {error: "Unknown dashboard action."}, origin);
});
