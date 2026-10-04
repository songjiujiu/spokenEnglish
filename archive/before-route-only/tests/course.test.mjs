import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCourse } from '../build.mjs';

const source = JSON.parse(await readFile(new URL('../src/course-data.json', import.meta.url), 'utf8'));
test('课程结构和 ID 有效', () => {
  assert.deepEqual(validateCourse(source), []);
  assert.equal(new Set(source.units.map(x=>x.id)).size, source.units.length);
});
test('重复 ID、错误阶段和题目索引会失败', () => {
  const data = structuredClone(source);
  data.units[1].id = data.units[0].id;
  data.units[0].stage = 99;
  data.units[0].check.answer = 3;
  const errors = validateCourse(data).join('\n');
  assert.match(errors, /重复/);
  assert.match(errors, /不存在的阶段/);
  assert.match(errors, /check/);
});
test('不完整的表达数量会失败', () => {
  const data = structuredClone(source);
  data.units[0].words.pop();
  assert.ok(validateCourse(data).some(x=>x.includes('恰好')));
});
