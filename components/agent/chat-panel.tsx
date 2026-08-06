"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { MessageCircle, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function MessageBubble({ message }: { message: UIMessage }) {
  const text = message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
  const toolsUsed = message.parts
    .filter((part) => part.type.startsWith("tool-"))
    .map((part) => part.type.replace(/^tool-/, ""));

  return (
    <div
      className={
        message.role === "user"
          ? "ml-8 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
          : "mr-8 rounded-lg bg-muted px-3 py-2 text-sm"
      }
    >
      {toolsUsed.length > 0 && (
        <p className="mb-1 text-xs opacity-70">🔍 {toolsUsed.join(", ")}</p>
      )}
      <p className="whitespace-pre-wrap">{text || "…"}</p>
    </div>
  );
}

export function ChatPanel({
  subjectType,
  subjectId,
  subjectName,
  initialMessages,
}: {
  subjectType: string;
  subjectId: string;
  subjectName: string;
  initialMessages: UIMessage[];
}) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    id: `${subjectType}-${subjectId}`,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/agent/chat",
      body: { subjectType, subjectId },
    }),
  });
  const busy = status === "submitted" || status === "streaming";

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm">
            <MessageCircle className="size-4" />
            Ask agent
          </Button>
        }
      />
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Ask about {subjectName}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-3 overflow-y-auto px-4">
          {messages.length === 0 && (
            <p className="pt-8 text-center text-sm text-muted-foreground">
              Ask anything about this record — the agent reads the CRM and can
              search the web.
            </p>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </div>
        <form
          className="flex gap-2 border-t p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim() || busy) return;
            sendMessage({ text: input });
            setInput("");
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the agent…"
            disabled={busy}
          />
          <Button type="submit" size="icon" disabled={busy || !input.trim()}>
            <Send className="size-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
