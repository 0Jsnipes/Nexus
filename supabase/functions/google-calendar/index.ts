import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
const APP_URL = Deno.env.get("APP_URL") || "https://chattychat.0jsnipes.com";
const FUNCTION_URL = Deno.env.get("GOOGLE_CALENDAR_FUNCTION_URL") || `${SUPABASE_URL}/functions/v1/google-calendar`;
const ENCRYPTION_KEY = Deno.env.get("GOOGLE_TOKEN_ENCRYPTION_KEY") || "";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin === APP_URL ? origin : APP_URL,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
});
const json = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });

const bytesToBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const base64ToBytes = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
const cryptoKey = async () => {
  const raw = base64ToBytes(ENCRYPTION_KEY);
  if (raw.length !== 32) throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
};
const encrypt = async (value: string) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await cryptoKey(), encoder.encode(value)));
  return `${bytesToBase64(iv)}.${bytesToBase64(encrypted)}`;
};
const decrypt = async (value: string) => {
  const [iv, encrypted] = value.split(".").map(base64ToBytes);
  return decoder.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await cryptoKey(), encrypted));
};

const authenticatedUser = async (req: Request) => {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  return data.user || null;
};

const exchangeCode = async (code: string) => {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: FUNCTION_URL,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) throw new Error(`Google token exchange failed: ${response.status}`);
  return response.json();
};

const refreshAccessToken = async (userId: string, refreshTokenEncrypted: string) => {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: await decrypt(refreshTokenEncrypted),
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new Error("Google authorization expired. Reconnect your account.");
  const tokens = await response.json();
  const expiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString();
  await admin.from("calendar_tokens").update({ access_token_encrypted: await encrypt(tokens.access_token), expires_at: expiresAt, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("provider", "google");
  return tokens.access_token as string;
};

const accessTokenFor = async (userId: string) => {
  const { data, error } = await admin.from("calendar_tokens").select("*").eq("user_id", userId).eq("provider", "google").single();
  if (error || !data) throw new Error("Connect Google Calendar first.");
  if (data.expires_at && new Date(data.expires_at).getTime() > Date.now() + 60_000) return decrypt(data.access_token_encrypted);
  if (!data.refresh_token_encrypted) throw new Error("Google authorization expired. Reconnect your account.");
  return refreshAccessToken(userId, data.refresh_token_encrypted);
};

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !ENCRYPTION_KEY) return json({ error: "google_not_configured" }, 503, origin);

  try {
    const url = new URL(req.url);
    if (req.method === "GET") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      if (!code || !state) return new Response("Invalid OAuth callback", { status: 400 });
      const { data: oauthState } = await admin.from("calendar_oauth_states").select("*").eq("state", state).single();
      if (!oauthState || new Date(oauthState.expires_at) < new Date()) return new Response("OAuth state expired", { status: 400 });
      const tokens = await exchangeCode(code);
      const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
      const googleProfile = await profileResponse.json();
      const existing = await admin.from("calendar_tokens").select("refresh_token_encrypted").eq("user_id", oauthState.user_id).eq("provider", "google").maybeSingle();
      await admin.from("calendar_tokens").upsert({
        user_id: oauthState.user_id,
        provider: "google",
        access_token_encrypted: await encrypt(tokens.access_token),
        refresh_token_encrypted: tokens.refresh_token ? await encrypt(tokens.refresh_token) : existing.data?.refresh_token_encrypted,
        expires_at: new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString(),
        scopes: tokens.scope,
        updated_at: new Date().toISOString(),
      });
      await admin.from("calendar_connections").upsert({ user_id: oauthState.user_id, provider: "google", account_email: googleProfile.email, external_account_id: googleProfile.sub, status: "active", updated_at: new Date().toISOString() }, { onConflict: "user_id,provider" });
      await admin.from("calendar_oauth_states").delete().eq("state", state);
      const redirect = new URL(oauthState.redirect_to);
      redirect.searchParams.set("integration", "google-connected");
      return Response.redirect(redirect.toString(), 302);
    }

    const user = await authenticatedUser(req);
    if (!user) return json({ error: "authentication_required" }, 401, origin);
    const body = await req.json();

    if (body.action === "auth-url") {
      const state = crypto.randomUUID();
      const redirectTo = typeof body.redirectTo === "string" && body.redirectTo.startsWith(APP_URL) ? body.redirectTo : APP_URL;
      await admin.from("calendar_oauth_states").insert({ state, user_id: user.id, provider: "google", redirect_to: redirectTo, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.search = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, redirect_uri: FUNCTION_URL, response_type: "code", access_type: "offline", prompt: "consent", state, scope: "openid email https://www.googleapis.com/auth/calendar.events" }).toString();
      return json({ url: authUrl.toString() }, 200, origin);
    }

    if (body.action === "disconnect") {
      await admin.from("calendar_tokens").delete().eq("user_id", user.id).eq("provider", "google");
      await admin.from("calendar_connections").delete().eq("user_id", user.id).eq("provider", "google");
      return json({ ok: true }, 200, origin);
    }

    if (body.action === "create-meeting") {
      const token = await accessTokenFor(user.id);
      const meeting = body.meeting;
      const start = new Date(meeting.starts_at);
      const end = new Date(start.getTime() + Number(meeting.duration_minutes || 30) * 60_000);
      const requestId = crypto.randomUUID();
      const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ summary: meeting.title, description: meeting.description || "Created in Nexus", start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() }, attendees: (body.attendeeEmails || []).map((email: string) => ({ email })), conferenceData: { createRequest: { requestId, conferenceSolutionKey: { type: "hangoutsMeet" } } } }),
      });
      if (!response.ok) throw new Error(`Google Calendar rejected the meeting: ${response.status}`);
      const event = await response.json();
      const joinUrl = event.hangoutLink || event.conferenceData?.entryPoints?.find((entry: { entryPointType: string }) => entry.entryPointType === "video")?.uri || null;
      return json({ eventId: event.id, calendarUrl: event.htmlLink, joinUrl }, 200, origin);
    }

    return json({ error: "unknown_action" }, 400, origin);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "internal_error" }, 500, origin);
  }
});
