import { FadeIn } from "./tweenly/fade-in";

type NodeProps = {
  title: string;
  lines: string[];
  tone?: "brand" | "allowed" | "held" | "plain";
  className?: string;
};

function Node({ title, lines, tone = "plain", className = "" }: NodeProps) {
  const ring =
    tone === "brand"
      ? "border-brand/50 bg-brand/[0.07] shadow-[0_0_60px_-20px_rgba(167,139,250,0.6)]"
      : tone === "allowed"
        ? "border-allowed/40 bg-allowed/[0.05]"
        : tone === "held"
          ? "border-held/40 bg-held/[0.05]"
          : "border-line bg-panel";
  return (
    <div className={`rounded-xl border p-4 ${ring} ${className}`}>
      <div className="text-[13px] font-semibold">{title}</div>
      <div className="mt-1.5 grid gap-0.5 font-mono text-[11px] leading-relaxed text-muted">
        {lines.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}

function HLine({ label }: { label?: string }) {
  return (
    <div className="relative hidden h-full min-h-10 items-center lg:flex">
      <div className="flow-x h-0.5 w-full opacity-80" />
      {label && (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[160%] whitespace-nowrap rounded-full border border-line bg-bg px-2 py-0.5 font-mono text-[10px] text-muted">
          {label}
        </span>
      )}
    </div>
  );
}

function VLine({ label }: { label?: string }) {
  return (
    <div className="relative mx-auto flex h-12 w-0.5 items-center justify-center">
      <div className="flow-y h-full w-0.5 opacity-80" />
      {label && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-line bg-bg px-2 py-0.5 font-mono text-[10px] text-muted">
          {label}
        </span>
      )}
    </div>
  );
}

/**
 * The system diagram: clients on the left, IntentGate in the middle with ArmorIQ above and
 * the Flight Recorder below, downstream MCP servers on the right. Connectors animate on
 * desktop; on mobile the columns stack.
 */
export function Architecture() {
  return (
    <FadeIn direction="up" distance={24} duration={0.8}>
      <div className="rounded-2xl border border-line bg-[#0c0c12] p-5 sm:p-8">
        {/* ArmorIQ, top center */}
        <div className="mx-auto max-w-xs">
          <Node
            tone="brand"
            title="ArmorIQ"
            lines={["startPlan → signed intent token", "enforceSdk → allow · block · hold", "report → dashboard trace"]}
          />
        </div>
        <VLine label="plan · decision · report" />

        {/* Main row */}
        <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_96px_1.25fr_96px_1fr]">
          <div className="grid content-center gap-3">
            <Node title="MCP clients" lines={["Claude Desktop", "Cursor · Claude Code", "any stdio client"]} />
            <Node title="ElevenLabs voice agent" lines={["Streamable HTTP /mcp", "per-call signed plan"]} />
          </div>

          <HLine label="tools/call" />

          <Node
            tone="brand"
            className="self-center"
            title="IntentGate"
            lines={[
              "1  declare_plan (required first)",
              "2  ArmorIQ decision",
              "3  argument binding",
              "4  hold → human approval",
              "5  forward · record",
            ]}
          />

          <HLine label="allowed only" />

          <div className="grid content-center gap-3">
            <Node tone="allowed" title="Downstream MCP servers" lines={["filesystem · stdio", "fetch · stdio", "your own · HTTP"]} />
            <Node tone="held" title="Humans" lines={["Approve · Deny in the recorder", "spoken alert via ElevenLabs"]} />
          </div>
        </div>

        <VLine label="events (WebSocket + JSONL)" />

        {/* Flight Recorder, bottom center */}
        <div className="mx-auto max-w-xs">
          <Node title="Flight Recorder · localhost:4747" lines={["plan vs. actual timeline", "which layer decided, and why", "replay saved sessions"]} />
        </div>
      </div>
    </FadeIn>
  );
}
