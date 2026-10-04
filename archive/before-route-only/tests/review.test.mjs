import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(await readFile(new URL('../src/review-domain.js', import.meta.url), 'utf8'), context);
const review = context.ChuyuReview;
const course = JSON.parse(await readFile(new URL('../src/course-data.json', import.meta.url), 'utf8'));
const NOW = Date.UTC(2026, 8, 30, 8);
const DAY = 86400000;
const plain = value => JSON.parse(JSON.stringify(value));
function freshCards() {
  const state = { schemaVersion: 1, cards: {}, mistakes: {} };
  review.ensureCards(state, course.units[0], NOW, course.version);
  return state;
}
function customCard(id, overrides = {}) {
  return { id, en: 'Hello', zh: '你好', context: '', unitId: null, wordIndex: null, due: NOW, level: 0, reviews: 0, createdAt: NOW, lastGrade: null, lastReviewed: null, algorithmVersion: 1, contentVersion: 1, ...overrides };
}
const mistakeInput = { id: 'u01-recall-0', unitId: 'u01', q: '我叫……', answer: 'My name is ...', userAnswer: 'I name', explain: '回忆本组表达。', correct: false };

test('生成三张立即到期的卡片，重复进入保留文案快照与已有排程', () => {
  const state = freshCards();
  assert.equal(Object.keys(state.cards).length, 3);
  assert.equal(review.dueCards(state, NOW - 1).length, 0);
  assert.equal(review.dueCards(state, NOW).length, 3);
  const first = state.cards['u01-w0'];
  assert.equal(first.context, 'Hello! My name is Mei.');
  review.gradeCard(state, first.id, 'good', { revealed: true, now: NOW });
  const before = plain(first);
  const changedUnit = structuredClone(course.units[0]);
  changedUnit.words[0].en = 'A new expression';
  assert.equal(review.ensureCards(state, changedUnit, NOW + DAY, 2).length, 0);
  assert.deepEqual(plain(first), before);
  assert.equal(first.contentVersion, 1);
});

test('上下文通过表达匹配确定，例句换序和缺失时不会错配', () => {
  const state = {};
  const unit = structuredClone(course.units[0]);
  unit.lines.reverse();
  unit.words[2].en = 'an expression not in these lines';
  review.ensureCards(state, unit, NOW);
  assert.equal(state.cards['u01-w0'].context, 'Hello! My name is Mei.');
  assert.equal(state.cards['u01-w1'].context, 'Nice to meet you.');
  assert.equal(state.cards['u01-w2'].context, '');
  const other = {};
  review.ensureCards(other, course.units[5], NOW);
  assert.equal(other.cards['u06-w2'].context, "Hot, please. That's all, thank you.");
});

test('三档反馈在所有等级边界遵循确定的间隔并累加复习次数', () => {
  for (const grade of ['again', 'hard', 'good']) {
    for (let level = 0; level <= 5; level++) {
      const state = freshCards();
      const card = state.cards['u01-w0'];
      card.level = level;
      card.reviews = 7;
      const result = review.gradeCard(state, card.id, grade, { revealed: true, now: NOW + 123 });
      const days = [1, 3, 7, 14, 30, 60][level];
      assert.equal(result, card);
      assert.equal(card.due, NOW + 123 + (grade === 'again' ? 600000 : grade === 'hard' ? DAY : days * DAY), `${grade}/${level} due`);
      assert.equal(card.level, grade === 'again' ? 0 : grade === 'hard' ? Math.max(0, level - 1) : Math.min(5, level + 1), `${grade}/${level} level`);
      assert.equal(card.reviews, 8);
      assert.equal(card.lastReviewed, NOW + 123);
      assert.equal(card.lastGrade, grade);
      assert.equal(card.algorithmVersion, 1);
    }
  }
});

test('未翻面、非法反馈或未知卡片不会改变记录，到期判断包含边界且排序稳定', () => {
  const state = freshCards(), before = plain(state);
  for (const options of [{ now: NOW }, { revealed: false, now: NOW }, { revealed: 1, now: NOW }]) assert.throws(() => review.gradeCard(state, 'u01-w0', 'good', options), /翻开/);
  assert.throws(() => review.gradeCard(state, 'u01-w0', 'excellent', { revealed: true, now: NOW }), /无效/);
  assert.throws(() => review.gradeCard(state, 'missing', 'good', { revealed: true, now: NOW }), /不存在/);
  assert.throws(() => review.gradeCard(state, '__proto__', 'good', { revealed: true, now: NOW }), /不存在/);
  assert.throws(() => review.gradeCard(state, 'u01-w0', 'good', { revealed: true, now: Number.NaN }), /时间/);
  assert.deepEqual(plain(state), before);
  state.cards['u01-w0'].due = NOW + 1;
  state.cards['u01-w1'].due = NOW;
  state.cards['u01-w2'].due = NOW - 1;
  assert.deepEqual(plain(review.dueCards(state, NOW).map(card => card.id)), ['u01-w2', 'u01-w1']);
});

test('运行中卡片上限按整组检查，失败不会留下部分新卡', () => {
  const state = { cards: Object.fromEntries(Array.from({ length: 2998 }, (_, i) => [`c-${i}`, customCard(`c-${i}`)])) };
  const before = plain(state);
  assert.throws(() => review.ensureCards(state, course.units[0], NOW), /3000/);
  assert.deepEqual(plain(state), before);
  delete state.cards['c-2997'];
  assert.equal(review.ensureCards(state, course.units[0], NOW).length, 3);
  assert.equal(Object.keys(state.cards).length, 3000);
  assert.equal(review.ensureCards(state, course.units[0], NOW).length, 0);
  const invalid = structuredClone(course.units[1]);
  invalid.words[2].en = '';
  const empty = {};
  assert.throws(() => review.ensureCards(empty, invalid, NOW), /英文/);
  assert.equal(empty.cards, undefined);
});

test('同题错误覆盖、正确解决保留错误快照，之后答错可重新打开', () => {
  const state = {};
  assert.equal(review.recordMistake(state, { ...mistakeInput, correct: true }, NOW), null);
  const mistake = review.recordMistake(state, mistakeInput, NOW);
  assert.equal(mistake.resolved, false);
  const resolved = review.recordMistake(state, { ...mistakeInput, correct: true, userAnswer: 'My name is ...' }, NOW + 1);
  assert.equal(resolved, mistake);
  assert.equal(resolved.userAnswer, 'I name');
  assert.equal(resolved.resolved, true);
  assert.equal(resolved.resolvedAt, NOW + 1);
  const reopened = review.recordMistake(state, { ...mistakeInput, userAnswer: 'Me name' }, NOW + 2);
  assert.equal(Object.keys(state.mistakes).length, 1);
  assert.equal(reopened.createdAt, NOW);
  assert.equal(reopened.updatedAt, NOW + 2);
  assert.equal(reopened.userAnswer, 'Me name');
  assert.equal(reopened.resolved, false);
  assert.equal(reopened.resolvedAt, null);
});

test('运行中错题上限不会静默丢失，已存在错题仍可更正', () => {
  const state = { mistakes: {} };
  for (let index = 0; index < 1000; index++) review.recordMistake(state, { ...mistakeInput, id: `u01-q${index}` }, NOW);
  const before = plain(state);
  assert.throws(() => review.recordMistake(state, mistakeInput, NOW + 1), /1000/);
  assert.deepEqual(plain(state), before);
  const existing = review.recordMistake(state, { ...mistakeInput, id: 'u01-q0', correct: true }, NOW + 1);
  assert.equal(existing.resolved, true);
  assert.equal(Object.keys(state.mistakes).length, 1000);
});

test('导出后再导入保留内置卡、自建卡、复习排程及错题解决标记', () => {
  const state = freshCards();
  state.cards['c-personal'] = customCard('c-personal', { en: 'My own phrase', context: 'Personal context' });
  review.gradeCard(state, 'u01-w0', 'hard', { revealed: true, now: NOW });
  review.recordMistake(state, mistakeInput, NOW);
  review.recordMistake(state, { ...mistakeInput, correct: true }, NOW + 1);
  const checked = review.sanitizeReviewData(plain(state), course, NOW + DAY);
  assert.deepEqual(plain(checked.issues), []);
  assert.deepEqual(plain(checked.cards), plain(state.cards));
  assert.deepEqual(plain(checked.mistakes), plain(state.mistakes));
  assert.deepEqual(plain(review.sanitizeReviewData({ schemaVersion: 1 }, course, NOW)), { cards: {}, mistakes: {}, issues: [] });
});

test('清洗限制数量和文本，报告修正与丢弃，不替换为新课程文案', () => {
  const state = freshCards();
  state.cards['u01-w0'].en = 'Old content snapshot';
  Object.assign(state.cards['u01-w0'], { level: 9, reviews: -1, due: -1, lastGrade: 'unknown', extra: true });
  state.cards['u01-w1'].context = 'x'.repeat(701);
  state.cards['u01-w2'].unitId = 'unknown-course';
  state.cards['c-with-unit'] = customCard('c-with-unit', { unitId: 'u01' });
  state.cards['c-empty'] = customCard('c-empty', { en: '' });
  const cleaned = review.sanitizeReviewData(state, course, NOW);
  assert.equal(cleaned.cards['u01-w0'].en, 'Old content snapshot');
  assert.equal(cleaned.cards['u01-w0'].due, NOW);
  assert.equal(cleaned.cards['u01-w0'].level, 5);
  assert.equal(cleaned.cards['u01-w0'].reviews, 0);
  assert.equal(cleaned.cards['u01-w0'].lastGrade, null);
  assert.equal(cleaned.cards['u01-w0'].extra, undefined);
  assert.equal(cleaned.cards['u01-w1'].context.length, 700);
  assert.equal(Object.keys(cleaned.cards).length, 2);
  assert.match(cleaned.issues.join('\n'), /extra/);
  assert.match(cleaned.issues.join('\n'), /context/);
  assert.match(cleaned.issues.join('\n'), /课程或表达引用无效/);
  const oversized = { cards: Object.fromEntries(Array.from({ length: 3001 }, (_, i) => [`c-${i}`, customCard(`c-${i}`)])), mistakes: {} };
  const sample = review.recordMistake({}, mistakeInput, NOW);
  for (let index = 0; index < 1001; index++) oversized.mistakes[`u01-q${index}`] = { ...sample, id: `u01-q${index}` };
  const limited = review.sanitizeReviewData(oversized, course, NOW);
  assert.equal(Object.keys(limited.cards).length, 3000);
  assert.equal(Object.keys(limited.mistakes).length, 1000);
  assert.match(limited.issues.join('\n'), /丢弃后续 1 张/);
  assert.match(limited.issues.join('\n'), /丢弃后续 1 条/);
});

test('未知数据及算法版本拒绝导入，不接受原型污染字段或危险 ID', () => {
  assert.throws(() => review.sanitizeReviewData({ schemaVersion: 2 }, course, NOW), /版本/);
  assert.throws(() => review.sanitizeReviewData({ formatId: 'another-format' }, course, NOW), /格式/);
  const future = freshCards();
  future.cards['u01-w0'].algorithmVersion = 2;
  assert.throws(() => review.sanitizeReviewData(future, course, NOW), /算法版本/);
  const malicious = JSON.parse('{"cards":{"__proto__":{"polluted":true},"constructor":{"id":"constructor"}},"mistakes":{"__proto__":{"polluted":true}}}');
  malicious.cards['c-safe'] = { ...customCard('c-safe'), ...JSON.parse('{"__proto__":{"polluted":true},"constructor":{"polluted":true}}') };
  const cleaned = review.sanitizeReviewData(malicious, course, NOW);
  assert.equal(Object.getPrototypeOf(cleaned.cards), null);
  assert.equal(Object.getPrototypeOf(cleaned.mistakes), null);
  assert.equal(Object.keys(cleaned.cards).length, 1);
  assert.equal(Object.hasOwn(cleaned.cards['c-safe'], '__proto__'), false);
  assert.equal(Object.hasOwn(cleaned.cards['c-safe'], 'constructor'), false);
  assert.equal({}.polluted, undefined);
  assert.equal(vm.runInContext('({}).polluted', context), undefined);
  assert.throws(() => review.recordMistake({}, { ...mistakeInput, id: '__proto__' }, NOW), /无效/);
});
