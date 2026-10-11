import { Marked, type Token, type Tokens } from "marked";
import { codeToHtml } from "shiki";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export interface Heading {
  id: string;
  text: string;
  depth: number;
}

const LANGS = new Set(["bash", "json", "ts", "typescript", "tsx", "js", "text", "txt"]);

/** Renders markdown to HTML with shiki code highlighting and linkable headings. */
export async function renderMarkdown(source: string): Promise<{ html: string; headings: Heading[] }> {
  const headings: Heading[] = [];
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const id = slugify(text);
        if (depth === 2 || depth === 3) headings.push({ id, text: text.replace(/<[^>]+>/g, ""), depth });
        return `<h${depth} id="${id}"><a href="#${id}" class="anchor">${text}</a></h${depth}>`;
      },
      link({ href, tokens }) {
        const text = this.parser.parseInline(tokens);
        // Repo-relative doc links (docs/quickstart.md) become site routes (/docs/quickstart).
        const fixed = href.replace(/^(?:\.\.\/)?(?:docs\/)?([\w-]+)\.md(#.*)?$/, "/docs/$1$2");
        const external = /^https?:\/\//.test(fixed);
        return `<a href="${fixed}"${external ? ' target="_blank" rel="noreferrer"' : ""}>${text}</a>`;
      },
    },
  });

  const tokens = marked.lexer(source);
  const highlight = async (list: Token[]) => {
    for (const token of list) {
      if (token.type === "code") {
        const code = token as Tokens.Code;
        const lang = LANGS.has(code.lang ?? "") ? code.lang! : "text";
        const html = await codeToHtml(code.text, { lang, theme: "github-dark-default" });
        Object.assign(token, { type: "html", text: `<div class="code">${html}</div>`, raw: code.raw, pre: false, block: true });
      } else if ("tokens" in token && Array.isArray(token.tokens)) {
        await highlight(token.tokens as Token[]);
      } else if (token.type === "list") {
        for (const item of (token as Tokens.List).items) await highlight(item.tokens);
      }
    }
  };
  await highlight(tokens);
  return { html: marked.parser(tokens), headings };
}
