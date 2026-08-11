// Google OAuth for the sync feature (separate from Supabase login auth).
// Server-side authorization-code flow; we only ever store the refresh token
// (encrypted) and mint short-lived access tokens on demand.

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function clientCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured");
  }
  return { clientId, clientSecret };
}

// Origin as the browser sees it (Vercel terminates TLS, so check the proxy
// header). The result must match a redirect URI registered in Google Cloud.
export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? url.host;
  const proto =
    request.headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function redirectUri(origin: string): string {
  return `${origin}/api/google/oauth/callback`;
}

export function buildAuthUrl(origin: string, state: string): string {
  const { clientId } = clientCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: GOOGLE_SCOPES,
    // offline + consent guarantees a refresh_token on every connect.
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

export type TokenExchange = {
  refreshToken: string;
  scopes: string;
  email: string;
};

export async function exchangeCode(
  origin: string,
  code: string,
): Promise<TokenExchange> {
  const { clientId, clientSecret } = clientCredentials();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(origin),
    }),
  });
  if (!res.ok) {
    throw new Error(
      `token exchange failed (${res.status}): ${await res.text()}`,
    );
  }
  const data = (await res.json()) as {
    refresh_token?: string;
    scope?: string;
    id_token?: string;
  };
  if (!data.refresh_token) {
    throw new Error("Google did not return a refresh token");
  }
  // The id_token arrived over TLS directly from Google's token endpoint, so
  // its payload is trustworthy without signature verification here.
  let email = "";
  if (data.id_token) {
    const payload = JSON.parse(
      Buffer.from(data.id_token.split(".")[1], "base64url").toString("utf8"),
    ) as { email?: string };
    email = payload.email ?? "";
  }
  return {
    refreshToken: data.refresh_token,
    scopes: data.scope ?? GOOGLE_SCOPES,
    email,
  };
}

export async function getAccessToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = clientCredentials();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(
      `token refresh failed (${res.status}): ${await res.text()}`,
    );
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}
