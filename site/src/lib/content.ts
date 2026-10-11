import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

// Docs live next to the package (../docs) so the README, npm page and website share one source.
const DOCS_DIR = path.join(process.cwd(), "..", "docs");
const BLOG_DIR = path.join(process.cwd(), "content", "blog");
export const CHANGELOG_FILE = path.join(process.cwd(), "..", "CHANGELOG.md");

export interface Doc {
  slug: string;
  title: string;
  description: string;
  order: number;
  body: string;
}

export interface Post {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  body: string;
}

function readDir(dir: string): { slug: string; data: Record<string, unknown>; body: string }[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const { data, content } = matter(fs.readFileSync(path.join(dir, f), "utf8"));
      return { slug: f.replace(/\.md$/, ""), data, body: content };
    });
}

export function getDocs(): Doc[] {
  return readDir(DOCS_DIR)
    .map(({ slug, data, body }) => ({
      slug,
      title: String(data.title ?? slug),
      description: String(data.description ?? ""),
      order: Number(data.order ?? 99),
      body,
    }))
    .sort((a, b) => a.order - b.order);
}

export function getDoc(slug: string): Doc | undefined {
  return getDocs().find((d) => d.slug === slug);
}

export function getPosts(): Post[] {
  return readDir(BLOG_DIR)
    .map(({ slug, data, body }) => ({
      slug,
      title: String(data.title ?? slug),
      description: String(data.description ?? ""),
      date: String(data.date ?? ""),
      author: String(data.author ?? "Manjunath Irukulla"),
      body,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getPost(slug: string): Post | undefined {
  return getPosts().find((p) => p.slug === slug);
}

export function readChangelog(): string {
  return fs.existsSync(CHANGELOG_FILE) ? fs.readFileSync(CHANGELOG_FILE, "utf8") : "";
}
