import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { buildAuthUrl, requestOrigin } from "@/lib/google/oauth";
import { createClient } from "@/lib/supabase/server";

// Kicks off the Google consent flow. Session-authed; a random state value in
// an httpOnly cookie ties the callback to this browser (CSRF protection).
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.ownerId, user.id),
  });
  if (!workspace) {
    return NextResponse.json({ error: "no workspace" }, { status: 403 });
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
