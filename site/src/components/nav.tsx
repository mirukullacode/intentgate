"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { docsUrl, site } from "@/lib/site";

const links = [
  { href: "/", label: "Home", external: false },
  { href: "/#how", label: "How it works", external: false },
  { href: "/#production", label: "In production", external: false },
  { href: docsUrl("quickstart"), label: "Docs", external: true },
  { href: site.github, label: "GitHub", external: true },
];

/** Quiet top bar for the playground page. The landing page uses the sidebar instead. */
export function Nav({ clerk = false }: { clerk?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-7xl items-center gap-8 px-5">
        <Link href="/" className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight">
          <span className="flex size-6 items-center justify-center rounded bg-text text-bg">
            <svg width="12" height="12" viewBox="0 0 32 32" aria-hidden>
              <path d="M9 22V10l7 6 7-6v12" stroke="currentColor" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          intentgate
        </Link>

        <div className="hidden items-center gap-6 text-[14px] text-muted md:flex">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target={l.external ? "_blank" : undefined}
              rel={l.external ? "noreferrer" : undefined}
              className="flex items-center gap-1 transition-colors hover:text-text"
            >
              {l.label}
              {l.external && <ArrowUpRight className="size-3" />}
            </a>
          ))}
        </div>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <span className="label flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-allowed" /> Playground
          </span>
          {clerk && (
            <>
              <SignedOut>
                <SignInButton mode="modal">
                  <button type="button" className="label h-9 border border-line px-3 text-text hover:bg-panel">
                    Sign in
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn>
            </>
          )}
          <a href={site.hackathonUrl} target="_blank" rel="noreferrer" className="label h-9 border border-line px-3 leading-9 text-text hover:bg-panel">
            Hackathon ↗
          </a>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="ml-auto flex size-9 items-center justify-center border border-line md:hidden"
        >
          <span className="relative block h-3 w-4">
            <span className={`absolute left-0 top-0 h-px w-4 bg-text transition-transform ${open ? "translate-y-1.5 rotate-45" : ""}`} />
            <span className={`absolute left-0 top-1.5 h-px w-4 bg-text transition-opacity ${open ? "opacity-0" : ""}`} />
            <span className={`absolute left-0 top-3 h-px w-4 bg-text transition-transform ${open ? "-translate-y-1.5 -rotate-45" : ""}`} />
          </span>
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
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
                  className="py-2 text-muted hover:text-text"
                >
                  {l.label}
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
