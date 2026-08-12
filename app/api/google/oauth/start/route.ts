import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getUserWorkspace } from "@/lib/auth";
import { buildAuthUrl, requestOrigin } from "@/lib/google/oauth";

// Kicks off the Google consent flow. Session-authed; a random state value in
// an httpOnly cookie ties the callback to this browser (CSRF protection).
export async function GET(request: Request) {
  if (!(await getUserWorkspace())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const state = randomBytes(16).toString("hex");
  const origin = requestOrigin(request);
  const res = NextResponse.redirect(buildAuthUrl(origin, state));
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: origin.startsWith("https"),
    sameSite: "lax",
    maxAge: 600,
    path: "/api/google/oauth",
  });
  return res;
}
