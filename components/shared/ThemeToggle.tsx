"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/components/shared/ThemeProvider";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark" | "system";

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "Terang", icon: <Sun className="h-4 w-4" /> },
    { value: "dark", label: "Gelap", icon: <Moon className="h-4 w-4" /> },
    { value: "system", label: "Sistem", icon: <Monitor className="h-4 w-4" /> },
  ];

  return (
    <div className="relative">
      <button
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5",
          "bg-secondary/50 hover:bg-secondary",
          "text-sm text-secondary-foreground",
          "transition-colors"
        )}
        onClick={() => {
          const idx = options.findIndex((o) => o.value === theme);
          setTheme(options[(idx + 1) % options.length].value);
        }}
        aria-label={`Tema: ${options.find((o) => o.value === theme)?.label}`}
        title={`Tema: ${options.find((o) => o.value === theme)?.label} — klik untuk ganti`}
      >
        {options.find((o) => o.value === resolvedTheme)?.icon}
        <span className="hidden sm:inline">{options.find((o) => o.value === theme)?.label}</span>
      </button>

      {/* Tooltip / dropdown on hover */}
      <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block z-50">
        <div className="rounded-lg bg-popover border border-border shadow-lg p-1 min-w-[110px]">
          {options.map((opt) => (
            <button
              key={opt.value}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm",
                "transition-colors hover:bg-accent",
                theme === opt.value && "bg-accent font-medium"
              )}
              onClick={() => setTheme(opt.value)}
            >
              {opt.icon}
              {opt.label}
              {theme === opt.value && <span className="ml-auto text-primary">✓</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}