export const site = {
  name: "IntentGate",
  tagline: "Intent enforcement for any MCP client and ElevenLabs voice agent, powered by ArmorIQ.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://intentgate-alpha.vercel.app",
  github: "https://github.com/mirukullacode/intentgate",
  npm: "https://www.npmjs.com/package/intentgate-mcp",
  author: "Manjunath Irukulla",
  authorUrl: "https://github.com/mirukullacode",
  authorX: "https://x.com/mirukullacode",
  hackathon: "ArmorIQ × ElevenLabs Flow State Hackathon",
  hackathonUrl: "https://luma.com/tttqkw24",
  /** The hosted playground. Empty until the Railway/Fly deploy is live. */
  playground: process.env.NEXT_PUBLIC_PLAYGROUND_URL ?? "https://intentgate-production.up.railway.app/play",
  /** Demo video. Empty until recorded. */
  video: process.env.NEXT_PUBLIC_VIDEO_URL ?? "",
};

/** Docs live in the package repo until the /docs routes ship. */
export function docsUrl(slug: string) {
  return `${site.github}/blob/main/docs/${slug}.md`;
}
