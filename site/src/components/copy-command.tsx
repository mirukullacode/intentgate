"use client";

import { useState } from "react";

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button
      onClick={copy}
      className="group flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3 font-mono text-[13.5px] transition-colors hover:border-brand/50"
      aria-label={`Copy command: ${command}`}
    >
      <span className="text-muted">$</span>
      <span>{command}</span>
      <span className="ml-2 text-xs text-muted transition-colors group-hover:text-brand">{copied ? "copied ✓" : "copy"}</span>
    </button>
  );
}
