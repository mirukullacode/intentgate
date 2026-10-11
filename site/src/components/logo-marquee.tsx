import { Marquee } from "./tweenly/marquee";

const items = ["Claude Desktop", "Cursor", "Claude Code", "ElevenLabs Agents", "ArmorIQ", "Any MCP server", "Windows · macOS · Linux"];

/** "Works with" strip under the hero. Plain wordmarks, no third-party logo assets. */
export function LogoMarquee() {
  return (
    <div className="mx-auto max-w-6xl px-5">
      <p className="mb-5 text-center text-[12px] uppercase tracking-[0.18em] text-muted">Works with the agents you already use</p>
      <Marquee duration={28} gap={56} repeat={4} className="py-2">
        {items.map((name) => (
          <span key={name} className="whitespace-nowrap text-[15px] font-semibold tracking-tight text-[#7f7f8e]">
            {name}
          </span>
        ))}
      </Marquee>
    </div>
  );
}
