"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "system", icon: Monitor, label: "System" },
  { value: "dark", icon: Moon, label: "Dark" },
] as const;

// Segmented three-state control (light / system / dark).
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex items-center gap-0.5 rounded-full border bg-background p-0.5">
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          aria-label={`${label} theme`}
          onClick={() => setTheme(value)}
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground",
            mounted && theme === value && "bg-muted text-foreground shadow-xs",
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
