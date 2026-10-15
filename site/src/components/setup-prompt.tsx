"use client";

import { useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

export const SETUP_PROMPT = `Set up IntentGate so every MCP tool call I make is checked against a signed plan.

1. Run: npx intentgate-mcp init            (Claude Desktop)  or  npx intentgate-mcp init --client cursor
2. It asks for an ArmorIQ API key from https://platform.armoriq.ai. Paste it.
3. Restart the client. Call declare_plan before any other tool, with the user's goal and the exact tool calls.
4. If a call is blocked, do not retry it. Tell the user what you could not do.
5. The Flight Recorder is at http://localhost:4747. Run "npx intentgate-mcp doctor" to see what ArmorIQ will allow, hold or block per tool.`;

/** The hatched "copy setup prompt" strip: a prompt an agent can follow to install IntentGate itself. */
export function SetupPrompt() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(SETUP_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="border border-line">
      <div className="hatch flex items-center">
        <button type="button" onClick={copy} className="label flex h-10 flex-1 items-center gap-2 px-4 text-left text-text hover:bg-panel/60">
          {copied ? <Check className="size-3.5 text-allowed" /> : <Copy className="size-3.5" />}
          {copied ? "copied" : "Copy setup prompt"}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Show the setup prompt"
          className="flex h-10 w-10 items-center justify-center border-l border-line text-muted hover:text-text"
        >
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
            <ChevronDown className="size-4" />
          </motion.span>
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.pre
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden whitespace-pre-wrap border-t border-line bg-panel px-4 py-3 font-mono text-[12px] leading-relaxed text-text/85"
          >
            {SETUP_PROMPT}
          </motion.pre>
        )}
      </AnimatePresence>
    </div>
  );
}
