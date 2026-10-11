import { renderMarkdown } from "@/lib/markdown";

/** Server component: renders trusted markdown from this repo (docs, blog, changelog). */
export async function Prose({ source }: { source: string }) {
  const { html } = await renderMarkdown(source);
  return <article className="prose max-w-none" dangerouslySetInnerHTML={{ __html: html }} />;
}
