import { describe, expect, it } from 'vitest';
import { checkBinding, globToRegex, normalizePathLike } from '../src/binding.js';

describe('argument binding', () => {
  const steps = [{ tool: 'workspace__read_file', params: { path: 'README.md' } }];

  it('allows the exact declared arguments', () => {
    expect(checkBinding(steps, 'workspace__read_file', { path: 'README.md' }).ok).toBe(true);
  });

  it('blocks the same tool with different arguments', () => {
    const r = checkBinding(steps, 'workspace__read_file', { path: '.ssh/id_rsa' });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('.ssh/id_rsa');
  });

  it('blocks path traversal that only looks like the declared path', () => {
    expect(checkBinding(steps, 'workspace__read_file', { path: 'README.md/../.ssh/id_rsa' }).ok).toBe(false);
    expect(checkBinding(steps, 'workspace__read_file', { path: './README.md' }).ok).toBe(true);
    expect(checkBinding(steps, 'workspace__read_file', { path: '.\\README.md' }).ok).toBe(true);
  });

  it('treats undeclared tools as out of plan', () => {
    expect(checkBinding(steps, 'web__http_post', { url: 'x' }).ok).toBe(false);
  });

  it('supports * and ** globs and the "*" wildcard value', () => {
    const globbed = [{ tool: 'workspace__read_file', params: { path: 'docs/**' } }];
    expect(checkBinding(globbed, 'workspace__read_file', { path: 'docs/a/b.md' }).ok).toBe(true);
    expect(checkBinding(globbed, 'workspace__read_file', { path: '.ssh/id_rsa' }).ok).toBe(false);
    const any = [{ tool: 'shop__lookup_order', params: { order_id: '*' } }];
    expect(checkBinding(any, 'shop__lookup_order', { order_id: '1042' }).ok).toBe(true);
  });

  it('compares numbers and numeric strings', () => {
    const s = [{ tool: 'shop__issue_refund', params: { order_id: '1042', amount_inr: 599 } }];
    expect(checkBinding(s, 'shop__issue_refund', { order_id: 1042, amount_inr: 599 }).ok).toBe(true);
    expect(checkBinding(s, 'shop__issue_refund', { order_id: '1042', amount_inr: 4999 }).ok).toBe(false);
  });

  it('allows any arguments when a step declares none', () => {
    expect(checkBinding([{ tool: 'workspace__list_files' }], 'workspace__list_files', { dir: '.' }).ok).toBe(true);
  });

  it('accepts a call if any matching step allows it', () => {
    const multi = [
      { tool: 'workspace__read_file', params: { path: 'README.md' } },
      { tool: 'workspace__read_file', params: { path: 'notes.md' } },
    ];
    expect(checkBinding(multi, 'workspace__read_file', { path: 'notes.md' }).ok).toBe(true);
  });

  it('normalizes and globs paths predictably', () => {
    expect(normalizePathLike('a\\b\\..\\c')).toBe('a/c');
    expect(globToRegex('src/*.ts').test('src/a.ts')).toBe(true);
    expect(globToRegex('src/*.ts').test('src/x/a.ts')).toBe(false);
  });
});
