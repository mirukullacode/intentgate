import { docsUrl } from "@/lib/site";
import { SpotlightCard } from "./tweenly/spotlight-card";
import { Stagger } from "./tweenly/stagger";

const findings = [
  {
    n: "01",
    title: "Same tool, different arguments",
    text: "ArmorIQ's plan check is tool-level. read_file(README.md) and read_file(.ssh/id_rsa) are the same tool, so the second passes. IntentGate binds arguments to the plan, with path normalization and globs.",
    tag: "shipped as a layer",
  },
  {
    n: "02",
    title: "Two policies, empty intersection",
    text: "Two same-priority policies on different MCP servers were intersected into an empty allow set, blocking everything. One org-wide policy fixed it. Now a one-line warning in doctor.",
    tag: "filed, with repro",
  },
  {
    n: "03",
    title: "The model is not the safety layer",
    text: "Claude Opus 5.5, Opus 4.8 and Haiku 5.5 all refused the poisoned README on their own. We did not tune the attack to beat them. The gateway makes the outcome independent of which model you woke up with.",
    tag: "stated honestly",
  },
  {
    n: "04",
    title: "Local verification has no key yet",
    text: "The backend publishes no IAP public key, so local mode fails closed on every call, including in-plan ones. Measured, documented, and the gateway runs in sdk mode instead: every decision made on ArmorIQ's server.",
    tag: "measured",
  },
];

export function Findings() {
  return (
    <>
      <Stagger className="grid gap-4 md:grid-cols-2" stagger={0.08}>
        {findings.map((f) => (
          <SpotlightCard key={f.n} className="h-full p-6" color="rgba(167,139,250,0.10)" borderColor="rgba(167,139,250,0.6)">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted">{f.n}</span>
              <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">{f.tag}</span>
            </div>
            <h3 className="mt-3 text-[17px] font-semibold tracking-tight">{f.title}</h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-[#c4c4d0]">{f.text}</p>
          </SpotlightCard>
        ))}
      </Stagger>
      <a href={docsUrl("dx-notes-armoriq")} target="_blank" rel="noreferrer" className="mt-6 inline-block text-sm text-brand">
        All twelve DX notes, each with how it was found →
      </a>
    </>
  );
}
