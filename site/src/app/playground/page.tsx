import type { Metadata } from "next";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { LiveDemo } from "@/components/live-demo";
import { Nav } from "@/components/nav";
import { FadeIn } from "@/components/tweenly/fade-in";
import { Button } from "@/components/ui/button";
import { clerkEnabled } from "../layout";

export const metadata: Metadata = {
  title: "Live playground",
  description: "Run a prompt-injection attack against a real agent, with and without IntentGate, and watch ArmorIQ decide every call.",
};

export default function PlaygroundPage() {
  const signIn = clerkEnabled ? (
    <div className="mt-4">
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
    <main>
      <Nav clerk={clerkEnabled} />
      <div className="mx-auto max-w-7xl px-5 pb-24 pt-12">
        <FadeIn direction="up" distance={8} duration={0.5}>
          <div className="label flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-allowed" /> Live · against the real ArmorIQ API · sandboxed, fake key, local attacker
          </div>
          <h1 className="mt-4 max-w-3xl text-[1.9rem] font-medium leading-[1.15] tracking-[-0.02em] sm:text-[2.4rem]">
            Watch an agent get hijacked. <span className="text-muted">Then watch it get stopped.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[15.5px] leading-relaxed text-text/70">
            Same poisoned README, same attacker. Pick who drives the tools, a real Claude model or a scripted agent that already fell
            for the injection, and whether intentgate is in the path. In a protected run, every allow and block is an ArmorIQ decision
            made on their server for that exact run.
          </p>
        </FadeIn>
        <div className="mt-10 border-t border-line pt-10">
          <LiveDemo signIn={signIn} />
        </div>
      </div>
    </main>
  );
}
