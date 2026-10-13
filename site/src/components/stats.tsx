import { NumberTicker } from "./tweenly/number-ticker";
import { Stagger } from "./tweenly/stagger";

const stats = [
  { value: 0, suffix: "", label: "lines of code changed in your agent", note: "init rewrites the MCP config, not your app" },
  { value: 1, suffix: "", label: "command to protect Claude Desktop or Cursor", note: "npx intentgate-mcp init" },
  { value: 2, suffix: "", label: "independent checks on every call", note: "ArmorIQ plan and policy, then argument binding" },
  { value: 650, suffix: " ms", label: "per ArmorIQ decision, measured", note: "server-side enforceSdk, Oct 10 spike" },
];

export function Stats() {
  return (
    <Stagger className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4" itemClassName="bg-panel">
      {stats.map((s) => (
        <div key={s.label} className="h-full p-6">
          <div className="text-4xl font-semibold tracking-tight">
            <NumberTicker value={s.value} suffix={s.suffix} duration={1.6} />
          </div>
          <div className="mt-2 text-[14px] text-text">{s.label}</div>
          <div className="mt-1 font-mono text-[11.5px] text-muted">{s.note}</div>
        </div>
      ))}
    </Stagger>
  );
}
