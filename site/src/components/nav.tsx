"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { docsUrl, site } from "@/lib/site";
import { Logo } from "./logo";

const links = [
  { href: "#how-it-works", label: "How it works", external: false },
  { href: "#architecture", label: "Architecture", external: false },
  { href: "#voice", label: "Voice agents", external: false },
  { href: docsUrl("quickstart"), label: "Docs", external: true },
  { href: site.hackathonUrl, label: "Hackathon", external: true },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40">
      <a
        href={site.hackathonUrl}
        target="_blank"
        rel="noreferrer"
        className="block bg-brand text-center text-[12px] font-medium text-[#120b24] transition-colors hover:bg-[#b89dff]"
      >
        <span className="inline-block py-1.5">
          Built live for the ArmorIQ × ElevenLabs Flow State hackathon · Oct 10 to 17 · follow the build →
        </span>
      </a>

      <nav className="border-b border-line bg-bg/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-5">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <Logo />
            IntentGate
          </Link>

          <div className="hidden items-center gap-6 text-[13.5px] text-muted md:flex">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target={l.external ? "_blank" : undefined}
                rel={l.external ? "noreferrer" : undefined}
                className="transition-colors hover:text-text"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="ml-auto hidden items-center gap-2 text-[13.5px] md:flex">
            <a
              href={site.github}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-line px-3.5 py-1.5 text-muted transition-colors hover:border-text/30 hover:text-text"
            >
              GitHub
            </a>
            <a
              href={docsUrl("quickstart")}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-text px-3.5 py-1.5 font-medium text-bg transition-transform active:scale-[0.97]"
            >
              Get started
            </a>
          </div>

          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="ml-auto flex size-9 items-center justify-center rounded-lg border border-line md:hidden"
          >
            <span className="relative block h-3 w-4">
              <span className={`absolute left-0 top-0 h-px w-4 bg-text transition-transform ${open ? "translate-y-1.5 rotate-45" : ""}`} />
              <span className={`absolute left-0 top-1.5 h-px w-4 bg-text transition-opacity ${open ? "opacity-0" : ""}`} />
              <span className={`absolute left-0 top-3 h-px w-4 bg-text transition-transform ${open ? "-translate-y-1.5 -rotate-45" : ""}`} />
            </span>
          </button>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden border-t border-line md:hidden"
            >
              <div className="grid gap-1 px-5 py-3 text-sm">
                {links.map((l) => (
                  <a
                    key={l.label}
                    href={l.href}
                    target={l.external ? "_blank" : undefined}
                    rel={l.external ? "noreferrer" : undefined}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-2 py-2 text-muted hover:bg-panel hover:text-text"
                  >
                    {l.label}
                  </a>
                ))}
                <a href={site.github} className="rounded-lg px-2 py-2 text-muted hover:bg-panel hover:text-text">
                  GitHub
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
}
