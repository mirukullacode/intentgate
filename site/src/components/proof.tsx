import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "./tweenly/fade-in";
import { TiltCard } from "./tweenly/tilt-card";

const decisions = [
  { call: "read_file README.md", action: "allow", by: "ArmorIQ server", reason: "enforcement_passed" },
  { call: "read_file .ssh/id_rsa", action: "block", by: "IntentGate binding", reason: "path differs from plan" },
  { call: "http_post → attacker", action: "block", by: "ArmorIQ", reason: "tool not in signed plan" },
  { call: "lookup_order 1042", action: "allow", by: "ArmorIQ server", reason: "enforcement_passed · voice" },
  { call: "amend_plan: payout change", action: "hold", by: "human", reason: "approval needed · spoken alert" },
  { call: "amend_plan: refund ₹4999", action: "hold", by: "human", reason: "approval needed · spoken alert" },
] as const;

/** Two real sessions, one table. Nothing here is a mock. */
export function Proof() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <FadeIn direction="right" distance={20}>
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Coding agent, poisoned README</CardTitle>
                <Badge variant="brand">signed by ArmorIQ</Badge>
              </div>
              <CardDescription>One allowed read, two blocked attempts, nothing reached the attacker.</CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <TiltCard maxTilt={3} scale={1.005} glareOpacity={0.08} className="w-full border border-line">
                <Image src="/proof/flight-recorder.png" alt="Flight Recorder: README read allowed, key read blocked by argument binding, HTTP post blocked by ArmorIQ" width={1440} height={1000} className="block w-full" />
              </TiltCard>
            </CardContent>
          </Card>
        </FadeIn>
        <FadeIn direction="left" distance={20}>
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Voice agent, social engineering</CardTitle>
                <Badge variant="held">2 held for a human</Badge>
              </div>
              <CardDescription>An ElevenLabs agent over the hosted gateway. Lookup allowed, payout change and refund held.</CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <TiltCard maxTilt={3} scale={1.005} glareOpacity={0.08} className="w-full border border-line">
                <Image src="/proof/voice-session.png" alt="Flight Recorder: voice session with an allowed order lookup and two plan changes waiting for approval" width={1440} height={1000} className="block w-full" />
              </TiltCard>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      <FadeIn>
        <div className="overflow-hidden rounded-2xl border border-line bg-panel">
          <table className="w-full text-[13px]">
            <thead className="bg-panel-2 text-left text-muted">
              <tr>
                <th className="p-3 font-medium">Call</th>
                <th className="p-3 font-medium">Decision</th>
                <th className="p-3 font-medium">Decided by</th>
                <th className="p-3 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="font-mono text-[12.5px]">
              {decisions.map((d) => (
                <tr key={d.call} className="border-t border-line">
                  <td className="p-3 text-text/80">{d.call}</td>
                  <td className="p-3">
                    <Badge variant={d.action === "allow" ? "allowed" : d.action === "hold" ? "held" : "blocked"}>{d.action}</Badge>
                  </td>
                  <td className="p-3 text-muted">{d.by}</td>
                  <td className="p-3 text-muted">{d.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FadeIn>
    </div>
  );
}
