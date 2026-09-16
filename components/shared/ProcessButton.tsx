"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ProcessButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  /** Pesan error (fail-loudly, merah). */
  error?: string | null;
  className?: string;
}

export function ProcessButton({
  onClick,
  disabled,
  loading,
  label = "Proses",
  error,
  className,
}: ProcessButtonProps) {
  return (
    <div className={className}>
      <Button
        onClick={onClick}
        disabled={disabled || loading}
        className="w-full sm:w-auto"
        size="lg"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Memproses…" : label}
      </Button>
      {error && (
        <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}