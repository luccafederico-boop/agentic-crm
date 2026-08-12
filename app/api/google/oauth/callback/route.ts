import { after, NextResponse } from "next/server";
import { enqueueTask } from "@/lib/agent/queue";
import { drainQueue } from "@/lib/agent/runner";
import { getUserWorkspace } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { googleAccounts } from "@/lib/db/schema";
import { exchangeCode, requestOrigin } from "@/lib/google/oauth";

export const maxDuration = 60;

function settingsRedirect(origin: string, params: Record<string, string>) {
  const url = new URL("/settings", origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const origin = requestOrigin(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.headers
    .get("cookie")
    ?.match(/google_oauth_state=([a-f0-9]+)/)?.[1];

  if (url.searchParams.get("error")) {
    return settingsRedirect(origin, { google: "denied" });
  }
  if (!code || !state || !cookieState || state !== cookieState) {
    return settingsRedirect(origin, { google: "state_mismatch" });
  }

  const auth = await getUserWorkspace();
  if (!auth) {
    return NextResponse.redirect(new URL("/login", origin));
  }
  const { workspace } = auth;

  try {
    const { refreshToken, scopes, email } = await exchangeCode(origin, code);
    await db
      .insert(googleAccounts)
      .values({
        workspaceId: workspace.id,
        email,
        refreshTokenEnc: encryptSecret(refreshToken),
        scopes,
      })
      .onConflictDoUpdate({
        target: googleAccounts.workspaceId,
        set: {
          email,
          refreshTokenEnc: encryptSecret(refreshToken),
          scopes,
          connectedAt: new Date(),
          lastSyncError: null,
        },
      });

    // Initial sync in the visible lane (no LLM involved).
    await enqueueTask({
      workspaceId: workspace.id,
      lane: "visible",
      kind: "google_sync",
      subjectType: "workspace",
      subjectId: workspace.id,
    });
    after(() => drainQueue(40_000));

    const res = settingsRedirect(origin, { google: "connected" });
    res.cookies.delete("google_oauth_state");
    return res;
  } catch (err) {
    console.error("[google oauth] callback failed:", err);
    return settingsRedirect(origin, { google: "error" });
  }
}
