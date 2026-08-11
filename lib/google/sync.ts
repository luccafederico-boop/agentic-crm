// Gmail + Calendar sync (visible lane, no LLM). Pulls recent messages and
// events from the connected Google account, matches participants against CRM
// contacts by email, and writes deduped timeline activities (external_id).
import { eq } from "drizzle-orm";
import { decryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { activities, contacts, googleAccounts } from "@/lib/db/schema";
import { getAccessToken } from "@/lib/google/oauth";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_MESSAGES = 50;
const MAX_EVENTS = 100;

export type SyncStats = {
  messagesScanned: number;
  emailsLinked: number;
  eventsScanned: number;
  meetingsLinked: number;
};

// "Ada Lovelace <ada@ex.com>, bob@ex.com" -> ["ada@ex.com", "bob@ex.com"]
export function extractEmails(headerValue: string | undefined): string[] {
  if (!headerValue) return [];
  return (
    headerValue.toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) ??
    []
  );
}

type ActivityRow = typeof activities.$inferInsert;

async function insertDeduped(rows: ActivityRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const inserted = await db
    .insert(activities)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: activities.id });
  return inserted.length;
}

async function googleGet(url: string, accessToken: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`Google API ${res.status} for ${new URL(url).pathname}`);
  }
  return res.json();
}

async function syncGmail(
  accessToken: string,
  workspaceId: string,
  contactByEmail: Map<string, string>,
  ownEmail: string,
  since: Date,
): Promise<Pick<SyncStats, "messagesScanned" | "emailsLinked">> {
  const afterEpoch = Math.floor(since.getTime() / 1000);
  const list = (await googleGet(
    `${GMAIL_API}/messages?q=after:${afterEpoch}&maxResults=${MAX_MESSAGES}`,
    accessToken,
  )) as { messages?: Array<{ id: string }> };
  const ids = (list.messages ?? []).map((m) => m.id);

  const rows: ActivityRow[] = [];
  for (const id of ids) {
    const msg = (await googleGet(
      `${GMAIL_API}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject`,
      accessToken,
    )) as {
      snippet?: string;
      internalDate?: string;
      payload?: { headers?: Array<{ name: string; value: string }> };
    };
    const header = (name: string) =>
      msg.payload?.headers?.find(
        (h) => h.name.toLowerCase() === name.toLowerCase(),
      )?.value;

    const from = extractEmails(header("From"));
    const toCc = [
      ...extractEmails(header("To")),
      ...extractEmails(header("Cc")),
    ];
    const incoming = !from.includes(ownEmail.toLowerCase());
    const occurredAt = msg.internalDate
      ? new Date(Number(msg.internalDate))
      : new Date();
    const subject = header("Subject") || "(no subject)";

    // Every matched contact on the thread gets its own timeline entry.
    const matched = new Set<string>();
    for (const email of [...from, ...toCc]) {
      const contactId = contactByEmail.get(email);
      if (contactId) matched.add(contactId);
    }
    for (const contactId of matched) {
      rows.push({
        workspaceId,
        type: "email",
        actor: "sync",
        subjectType: "contact",
        subjectId: contactId,
        title: `${incoming ? "Email received" : "Email sent"}: ${subject}`,
        body: msg.snippet || null,
        externalId: `gmail:${id}:${contactId}`,
        occurredAt,
      });
    }
  }
  return {
    messagesScanned: ids.length,
    emailsLinked: await insertDeduped(rows),
  };
}

async function syncCalendar(
  accessToken: string,
  workspaceId: string,
  contactByEmail: Map<string, string>,
  now: Date,
): Promise<Pick<SyncStats, "eventsScanned" | "meetingsLinked">> {
  const timeMin = new Date(now.getTime() - LOOKBACK_MS).toISOString();
  const timeMax = new Date(
    now.getTime() + 60 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(MAX_EVENTS),
  });
  const data = (await googleGet(
    `${CALENDAR_API}/calendars/primary/events?${params}`,
    accessToken,
  )) as {
    items?: Array<{
      id: string;
      summary?: string;
      description?: string;
      status?: string;
      start?: { dateTime?: string; date?: string };
      attendees?: Array<{ email?: string }>;
    }>;
  };
  const events = (data.items ?? []).filter((e) => e.status !== "cancelled");

  const rows: ActivityRow[] = [];
  for (const event of events) {
    const start = event.start?.dateTime ?? event.start?.date;
    const matched = new Set<string>();
    for (const attendee of event.attendees ?? []) {
      const contactId = contactByEmail.get(attendee.email?.toLowerCase() ?? "");
      if (contactId) matched.add(contactId);
    }
    for (const contactId of matched) {
      rows.push({
        workspaceId,
        type: "meeting",
        actor: "sync",
        subjectType: "contact",
        subjectId: contactId,
        title: `Meeting: ${event.summary || "(untitled)"}`,
        body: event.description?.slice(0, 500) || null,
        externalId: `gcal:${event.id}:${contactId}`,
        occurredAt: start ? new Date(start) : new Date(),
      });
    }
  }
  return {
    eventsScanned: events.length,
    meetingsLinked: await insertDeduped(rows),
  };
}

export async function runGoogleSync(workspaceId: string): Promise<SyncStats> {
  const account = await db.query.googleAccounts.findFirst({
    where: eq(googleAccounts.workspaceId, workspaceId),
  });
  if (!account) throw new Error("No Google account connected");

  try {
    const accessToken = await getAccessToken(
      decryptSecret(account.refreshTokenEnc),
    );

    const workspaceContacts = await db
      .select({ id: contacts.id, email: contacts.email })
      .from(contacts)
      .where(eq(contacts.workspaceId, workspaceId));
    const contactByEmail = new Map<string, string>();
    for (const c of workspaceContacts) {
      if (c.email) contactByEmail.set(c.email.toLowerCase(), c.id);
    }

    const now = new Date();
    const since = account.lastSyncAt ?? new Date(now.getTime() - LOOKBACK_MS);

    const gmail = await syncGmail(
      accessToken,
      workspaceId,
      contactByEmail,
      account.email,
      since,
    );
    const calendar = await syncCalendar(
      accessToken,
      workspaceId,
      contactByEmail,
      now,
    );

    await db
      .update(googleAccounts)
      .set({ lastSyncAt: now, lastSyncError: null })
      .where(eq(googleAccounts.id, account.id));

    return { ...gmail, ...calendar };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(googleAccounts)
      .set({ lastSyncError: message })
      .where(eq(googleAccounts.id, account.id));
    throw err;
  }
}
