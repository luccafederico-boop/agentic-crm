import { hasSupabaseEnv } from "@/lib/supabase/middleware";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in — Agentic CRM" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Agentic CRM</h1>
          <p className="text-sm text-muted-foreground">
            A CRM where a research agent does the busywork.
          </p>
        </div>
        {hasSupabaseEnv() ? (
          <LoginForm />
        ) : (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Setup required</p>
            <p className="mt-1">
              Copy <code>.env.example</code> to <code>.env</code> and fill in
              your Supabase project keys, then restart the dev server.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
