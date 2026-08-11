"use server";

import { and, eq, ilike, or } from "drizzle-orm";
import { ensureWorkspace } from "@/lib/auth";
import { db } from "@/lib/db";
import { companies, contacts, deals } from "@/lib/db/schema";

export type QuickSearchResult = {
  contacts: Array<{ id: string; name: string; email: string | null }>;
  companies: Array<{ id: string; name: string; domain: string | null }>;
  deals: Array<{ id: string; title: string; stage: string }>;
};

const EMPTY: QuickSearchResult = { contacts: [], companies: [], deals: [] };

export async function quickSearch(query: string): Promise<QuickSearchResult> {
  const q = query.trim();
  if (q.length < 2) return EMPTY;
  const workspace = await ensureWorkspace();
  const like = `%${q}%`;

  const [contactRows, companyRows, dealRows] = await Promise.all([
    db
      .select({ id: contacts.id, name: contacts.name, email: contacts.email })
      .from(contacts)
      .where(
        and(
          eq(contacts.workspaceId, workspace.id),
          or(ilike(contacts.name, like), ilike(contacts.email, like)),
        ),
      )
      .orderBy(contacts.name)
      .limit(6),
    db
      .select({
        id: companies.id,
        name: companies.name,
        domain: companies.domain,
      })
      .from(companies)
      .where(
        and(
          eq(companies.workspaceId, workspace.id),
          or(ilike(companies.name, like), ilike(companies.domain, like)),
        ),
      )
      .orderBy(companies.name)
      .limit(6),
    db
      .select({ id: deals.id, title: deals.title, stage: deals.stage })
      .from(deals)
      .where(and(eq(deals.workspaceId, workspace.id), ilike(deals.title, like)))
      .orderBy(deals.title)
      .limit(6),
  ]);

  return { contacts: contactRows, companies: companyRows, deals: dealRows };
}
