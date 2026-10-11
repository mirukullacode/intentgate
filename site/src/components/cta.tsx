"use client";

import { docsUrl, site } from "@/lib/site";
import { CopyCommand } from "./copy-command";
import { FadeIn } from "./tweenly/fade-in";
import { ShineButton } from "./tweenly/shine-button";

export function Cta() {
  const href = site.playground || docsUrl("quickstart");
  return (
    <section className="cta-band border-t border-line">
      <div className="mx-auto max-w-6xl px-5 py-28 text-center">
        <FadeIn direction="up" distance={20}>
          <h2 className="mx-auto max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Watch your agent get blocked
            <br className="hidden sm:block" /> in the next five minutes.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[16px] text-[#c4c4d0]">
            A poisoned workspace, a fake key, and a support desk to attack. Nothing real is touched.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <CopyCommand command="npx intentgate demo" />
            <a href={href} target="_blank" rel="noreferrer">
              <ShineButton beamColor="#a78bfa" variant="solid" className="h-12">
                {site.playground ? "Open the live playground" : "Read the quickstart"}
                <span aria-hidden>→</span>
              </ShineButton>
            </a>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
