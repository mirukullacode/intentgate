"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CopyCommand } from "./copy-command";

const clients = [
  {
    key: "claude",
    label: "Claude Desktop",
    status: "tested",
    steps: ["npx intentgate-mcp init", "Restart Claude Desktop"],
    note: "Wraps every MCP server already in your config. Backs the original up. One command undoes it.",
  },
  {
    key: "cursor",
    label: "Cursor",
    status: "wired",
    steps: ["npx intentgate-mcp init --client cursor", "Restart Cursor"],
    note: "Same flow, Cursor's config path. Claude Code reads the same shape, point it at the generated entry.",
  },
  {
    key: "voice",
    label: "ElevenLabs agent",
    status: "tested",
    steps: ["npx intentgate-mcp serve --token <secret>", "Agents → Integrations → Add Custom MCP Server"],
    note: "Every phone call gets its own signed plan. Holds go to a supervisor with a spoken alert.",
  },
  {
    key: "any",
    label: "Any MCP client",
    status: "by design",
    steps: ["npx intentgate-mcp serve --token <secret>", "Point the client at http://host:8787/mcp"],
    note: "n8n, LangChain, OpenAI Agents, your own code. If it speaks MCP over HTTP, it works.",
  },
  {
    key: "try",
    label: "Just try it",
    status: "no setup",
    steps: ["npx intentgate-mcp agent --hijacked", "npx intentgate-mcp doctor"],
    note: "The scripted attack through the real engine, then a per-tool report of what ArmorIQ will allow, hold or block.",
  },
];

export function InstallTabs() {
  return (
    <Tabs defaultValue="claude">
      <TabsList className="h-auto flex-wrap">
        {clients.map((c) => (
          <TabsTrigger key={c.key} value={c.key}>
            {c.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {clients.map((c) => (
        <TabsContent key={c.key} value={c.key}>
          <div className="grid gap-4 rounded-2xl border border-line bg-panel p-5 md:grid-cols-[1fr_1.2fr] md:items-center">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[17px] font-semibold">{c.label}</h3>
                <Badge variant={c.status === "tested" ? "allowed" : c.status === "no setup" ? "brand" : "default"}>{c.status}</Badge>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-text/70">{c.note}</p>
              <p className="mt-3 text-[12.5px] text-muted">Needs Node 20+ and an ArmorIQ API key. Add --offline to try without one.</p>
            </div>
            <ol className="grid gap-2">
              {c.steps.map((s, i) => (
                <li key={s} className="flex items-center gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line font-mono text-[11px] text-muted">{i + 1}</span>
                  {s.startsWith("npx") ? <CopyCommand command={s} /> : <span className="text-[14px]">{s}</span>}
                </li>
              ))}
            </ol>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
