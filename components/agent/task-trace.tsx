import { and, desc, eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { agentEvents, agentTasks } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { AutoRefresh } from "./auto-refresh";

const STATUS_VARIANT: Record<string, string> = {
  queued: "text-amber-600",
  running: "text-blue-600",
  done: "text-green-600",
  failed: "text-destructive",
};

function eventLabel(type: string, data: unknown): string {
  const d = (data ?? {}) as Record<string, unknown>;
  switch (type) {
    case "started":
      return `Started (attempt ${d.attempt ?? "?"})`;
    case "step": {
      const calls = Array.isArray(d.toolCalls) ? d.toolCalls.join(", ") : "";
      return calls ? `Used: ${calls}` : "Thinking…";
    }
    case "fact":
      return `Fact ${d.status}: ${d.field} = "${d.value}" (${d.band})`;
    case "finished":
      return "Finished";
    case "error":
      return `Error: ${d.message ?? "unknown"}`;
    default:
      return type;
  }
}

export async function TaskTrace({
  subjectType,
  subjectId,
}: {
  subjectType: string;
  subjectId: string;
}) {
  const task = await db.query.agentTasks.findFirst({
    where: and(
      eq(agentTasks.subjectType, subjectType),
      eq(agentTasks.subjectId, subjectId),
    ),
    orderBy: desc(agentTasks.createdAt),
  });
  if (!task) return null;

  const events = await db
    .select()
    .from(agentEvents)
    .where(eq(agentEvents.taskId, task.id))
    .orderBy(desc(agentEvents.createdAt))
    .limit(8);

  const active = task.status === "queued" || task.status === "running";

  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-xs">
      {active && <AutoRefresh />}
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">
          Last agent run{" "}
          <span className={STATUS_VARIANT[task.status] ?? ""}>
            · {task.status}
          </span>
        </span>
        <Badge variant="outline">{task.kind}</Badge>
      </div>
      <ol className="space-y-1 text-muted-foreground">
        {events.map((e) => (
          <li key={e.id} className="flex justify-between gap-3">
            <span className="min-w-0 truncate">
              {eventLabel(e.type, e.data)}
            </span>
            <time className="shrink-0">{formatDateTime(e.createdAt)}</time>
          </li>
        ))}
      </ol>
      {task.lastError && (
        <p className="mt-2 text-destructive">Last error: {task.lastError}</p>
      )}
    </div>
  );
}
