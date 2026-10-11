#!/usr/bin/env node
/**
 * Demo MCP server: a tiny filesystem confined to one folder.
 * Usage: node workspace-server.js <root-folder>
 */
import fs from 'node:fs';
import path from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const root = path.resolve(process.argv[2] ?? process.cwd());

function resolveInside(p: string): string {
  const full = path.resolve(root, p);
  if (full !== root && !full.startsWith(root + path.sep)) throw new Error(`'${p}' is outside the workspace`);
  return full;
}

const server = new Server({ name: 'workspace', version: '0.1.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'list_files',
      description: 'List files in a folder of the workspace (recursively, hidden files included).',
      inputSchema: { type: 'object', properties: { dir: { type: 'string', default: '.' } } },
    },
    {
      name: 'read_file',
      description: 'Read a text file from the workspace.',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    },
    {
      name: 'write_file',
      description: 'Write a text file in the workspace.',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content'],
      },
    },
  ],
}));

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [path.relative(root, full).replace(/\\/g, '/')];
  });
}

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = (req.params.arguments ?? {}) as Record<string, string>;
  try {
    switch (req.params.name) {
      case 'list_files':
        return { content: [{ type: 'text', text: walk(resolveInside(args.dir ?? '.')).join('\n') }] };
      case 'read_file':
        return { content: [{ type: 'text', text: fs.readFileSync(resolveInside(args.path), 'utf8') }] };
      case 'write_file':
        fs.writeFileSync(resolveInside(args.path), args.content ?? '');
        return { content: [{ type: 'text', text: `Wrote ${args.path}` }] };
      default:
        return { content: [{ type: 'text', text: `Unknown tool ${req.params.name}` }], isError: true };
    }
  } catch (err) {
    return { content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }], isError: true };
  }
});

await server.connect(new StdioServerTransport());
