"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function DocsSidebar({ docs }: { docs: { slug: string; title: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-0.5 text-sm">
      <div className="mb-2 text-xs font-medium uppercase tracking-widest text-muted">Documentation</div>
      {docs.map((d) => {
        const active = pathname === `/docs/${d.slug}`;
        return (
          <Link
            key={d.slug}
            href={`/docs/${d.slug}`}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              active ? "bg-panel-2 font-medium text-text" : "text-muted hover:text-text"
            }`}
          >
            {d.title}
          </Link>
        );
      })}
      <div className="mb-2 mt-6 text-xs font-medium uppercase tracking-widest text-muted">For AI tools</div>
      <a href="/llms.txt" className="rounded-lg px-3 py-1.5 text-muted hover:text-text">
        llms.txt
      </a>
      <a href="/llms-full.txt" className="rounded-lg px-3 py-1.5 text-muted hover:text-text">
        llms-full.txt
      </a>
    </nav>
  );
}
