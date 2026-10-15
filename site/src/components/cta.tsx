"use client";

import Link from "next/link";
import { CopyCommand } from "./copy-command";
import { FadeIn } from "./tweenly/fade-in";
import { ShineButton } from "./tweenly/shine-button";

export function Cta() {
  return (
    <section className="border-t border-line bg-panel/40">
      <div className="mx-auto max-w-6xl px-5 py-28 text-center">
        <FadeIn direction="up" distance={20}>
          <h2 className="mx-auto max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Watch your agent get blocked
            <br className="hidden sm:block" /> in the next five minutes.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[16px] text-text/70">
            A poisoned workspace, a fake key, and a support desk to attack. Nothing real is touched.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <CopyCommand command="npx intentgate-mcp agent" />
            <Link href="/playground">
              <ShineButton beamColor="#0a3dff" variant="solid" className="h-12">
                Open the live playground
                <span aria-hidden>→</span>
              </ShineButton>
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
