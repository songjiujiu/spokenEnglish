import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';

test('portable HTML embeds scripts, styles and the resource directory', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  execFileSync(process.execPath, ['build.mjs'], {cwd:root});
  const html = await readFile(new URL('../初语_学习程序.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /<script\s+src=/);
  assert.doesNotMatch(html, /<link[^>]+rel="stylesheet"/);
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 2);
  for (const [,code] of scripts) assert.doesNotThrow(() => new Script(code));
  assert.match(html, /unischool\.cn/);
  assert.match(html, /bj\.xdf\.cn/);
});
