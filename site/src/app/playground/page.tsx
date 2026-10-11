import type { Metadata } from "next";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { LiveDemo } from "@/components/live-demo";
import { FadeIn } from "@/components/tweenly/fade-in";
import { TextReveal } from "@/components/tweenly/text-reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clerkEnabled } from "../layout";

export const metadata: Metadata = {
  title: "Live playground",
  description: "Run a prompt-injection attack against a real agent, with and without IntentGate, and watch ArmorIQ decide every call.",
};

export default function PlaygroundPage() {
  const signIn = clerkEnabled ? (
    <div className="mt-2">
      <SignedOut>
        <SignInButton mode="modal">
          <Button variant="outline" size="sm" className="w-full">
            Sign in to keep your runs
          </Button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <div className="flex items-center gap-2 text-[12.5px] text-muted">
          <UserButton /> Signed in. Runs stay with your account.
        </div>
      </SignedIn>
    </div>
  ) : null;

  return (
    <main className="hero-glow">
      <div className="mx-auto max-w-7xl px-5 pb-24 pt-14">
        <FadeIn direction="up" distance={14} duration={0.6}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="live">
              <span className="size-1.5 rounded-full bg-allowed shadow-[0_0_8px_var(--allowed)]" /> live, against the real ArmorIQ API
            </Badge>
            <Badge>sandboxed · fake key · local attacker</Badge>
          </div>
        </FadeIn>
        <h1 className="mt-4 max-w-3xl text-[2.2rem] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[3rem]">
          <TextReveal as="span" text="Watch an agent get hijacked." stagger={0.05} className="block" />
          <TextReveal
            as="span"
            text="Then watch it get stopped."
            stagger={0.05}
            delay={0.35}
            className="block font-serif italic font-normal text-brand"
          />
        </h1>
        <FadeIn direction="up" distance={12} delay={0.5}>
          <p className="mt-4 max-w-2xl text-[15.5px] leading-relaxed text-[#c4c4d0]">
            The same poisoned README, the same attacker. Pick who drives the tools, a real Claude model or a scripted agent that
            already fell for the injection, and whether IntentGate is in the path. Every allow and block in a protected run is an
            ArmorIQ decision made on their server for this exact run.
          </p>
        </FadeIn>
        <div className="mt-10">
          <LiveDemo signIn={signIn} />
        </div>
      </div>
    </main>
  );
}
