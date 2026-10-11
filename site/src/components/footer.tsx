import { docsUrl, site } from "@/lib/site";
import { Logo } from "./logo";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Quickstart", href: docsUrl("quickstart") },
      { label: "How it works", href: docsUrl("how-it-works") },
      { label: "CLI reference", href: docsUrl("cli") },
      { label: "Flight Recorder", href: docsUrl("flight-recorder") },
      { label: "Security model", href: docsUrl("security") },
    ],
  },
  {
    title: "Integrations",
    links: [
      { label: "Claude Desktop", href: docsUrl("quickstart") },
      { label: "Cursor", href: docsUrl("configuration") },
      { label: "ElevenLabs agents", href: docsUrl("elevenlabs") },
      { label: "ArmorIQ", href: "https://armoriq.ai" },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "GitHub", href: site.github },
      { label: "npm", href: site.npm },
      { label: "DX notes on ArmorIQ", href: docsUrl("dx-notes-armoriq") },
      { label: "Hackathon", href: site.hackathonUrl },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-[#07070a]">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5 font-semibold">
            <Logo size={22} /> IntentGate
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted">{site.tagline}</p>
          <div className="mt-5 flex items-center gap-3">
            <a href={site.github} aria-label="GitHub" className="text-muted transition-colors hover:text-text">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 .5A11.5 11.5 0 0 0 .5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.27 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" />
              </svg>
            </a>
            <a href={site.authorX} aria-label="X" className="text-muted transition-colors hover:text-text">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M18.9 2H22l-7.3 8.4L23 22h-6.8l-5.3-6.9L4.8 22H1.7l7.8-8.9L1 2h6.9l4.8 6.3L18.9 2Zm-1.2 18h1.9L7.4 3.9H5.4L17.7 20Z" />
              </svg>
            </a>
          </div>
        </div>

        {columns.map((c) => (
          <div key={c.title} className="grid content-start gap-2.5 text-sm">
            <span className="mb-1 text-[12px] font-medium uppercase tracking-wider text-muted">{c.title}</span>
            {c.links.map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="text-[#c4c4d0] transition-colors hover:text-text">
                {l.label}
              </a>
            ))}
          </div>
        ))}
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-xs text-muted">
          <span>
            © {new Date().getFullYear()} IntentGate · MIT · Built by{" "}
            <a href={site.authorUrl} className="text-text underline decoration-line underline-offset-4">
              {site.author}
            </a>
          </span>
          <span>Not affiliated with ArmorIQ or ElevenLabs. Demo data is sandboxed and fake.</span>
        </div>
      </div>
    </footer>
  );
}
