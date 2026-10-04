import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../src/today-progress.js', import.meta.url), 'utf8');
const plan = JSON.parse(await readFile(new URL('../src/study-plan-data.json', import.meta.url), 'utf8'));
const windowStub = {};
// Progress rules must also work when browser storage is disabled or unavailable.
Object.defineProperty(windowStub, 'localStorage', {
  get() { throw new Error('Storage is unavailable'); }
});
runInNewContext(source, { window: windowStub }, { filename: 'today-progress.js' });
const create = windowStub.ChuyuTodayProgress.create;
const plain = value => JSON.parse(JSON.stringify(value));
const fixture = [1, 2].map(week => ({
  week,
  days: Array.from({ length: 6 }, (_, index) => ({ day: index + 1, title: `Task ${week}-${index + 1}` }))
}));

test('corrupt saved values recover to a usable first session', () => {
  const progress = create(fixture);
  for (const raw of [null, undefined, '1-1', 12, [], {}, { version: 2, week: 2, day: 6, completed: ['2-6'] }]) {
    assert.deepEqual(plain(progress.sanitize(raw)), { version: 1, week: 1, day: 1, completed: [] });
    assert.equal(progress.session(raw).index, 0);
    assert.equal(progress.next(raw).moved, false);
  }
  for (const [week, day] of [[0, 1], [3, 1], [1, 0], [1, 7], [1.5, 1], [1, NaN], ['2', '1']]) {
    const state = progress.sanitize({ version: 1, week, day, completed: ['2-3', '999-1', '2-3', '1-7', 3, null] });
    assert.deepEqual(plain(state), { version: 1, week: 1, day: 1, completed: ['2-3'] });
    assert.equal(progress.session(state).day.title, 'Task 1-1');
  }
  assert.deepEqual(plain(progress.sanitize({ version: 1, week: 2, day: 4, completed: '2-4' })), {
    version: 1, week: 2, day: 4, completed: []
  });
});

test('completion records the current task once and leaves advancement to the learner', () => {
  const progress = create(fixture);
  const initial = progress.defaultState();
  Object.freeze(initial.completed);
  Object.freeze(initial);
  assert.equal(progress.isCompleted(initial), false);
  assert.deepEqual(plain(progress.next(initial)), { state: plain(initial), moved: false, finished: false, rest: false });
  const completed = progress.complete(initial);
  assert.deepEqual(plain(completed), { version: 1, week: 1, day: 1, completed: ['1-1'] });
  assert.equal(progress.isCompleted(completed), true);
  assert.deepEqual(plain(progress.complete(completed)), plain(completed));
  assert.deepEqual(plain(initial), { version: 1, week: 1, day: 1, completed: [] });
  const advanced = progress.next(completed);
  assert.deepEqual(plain(advanced), {
    state: { version: 1, week: 1, day: 2, completed: ['1-1'] }, moved: true, finished: false, rest: false
  });
  assert.equal(progress.isCompleted(advanced.state), false);
  assert.equal(progress.next(advanced.state).moved, false);
});

test('manual relocation preserves records and cannot silently complete a task', () => {
  const progress = create(fixture);
  const initial = progress.complete(progress.defaultState());
  const relocated = progress.locate(initial, 2, 6);
  assert.deepEqual(plain(relocated), { version: 1, week: 2, day: 6, completed: ['1-1'] });
  assert.equal(progress.isCompleted(relocated), false);
  assert.equal(progress.next(relocated).finished, false);
  assert.deepEqual(plain(initial), { version: 1, week: 1, day: 1, completed: ['1-1'] });
  for (const [week, day] of [[102, 6], [2, 7], [-1, 1], [2.2, 1], ['2', 1]]) {
    assert.deepEqual(plain(progress.locate(relocated, week, day)), plain(relocated));
  }
  const end = progress.next(progress.complete(relocated));
  assert.equal(end.finished, true);
  assert.equal(end.moved, false);
  assert.equal(end.state.completed.length, 2, 'reaching the last task is not completion of the entire plan');
});

test('a completed sixth day advances to the next week with a rest reminder', () => {
  const progress = create(fixture);
  const sixth = progress.locate(progress.defaultState(), 1, 6);
  assert.equal(progress.next(sixth).rest, false);
  const result = progress.next(progress.complete(sixth));
  assert.deepEqual(plain(result), {
    state: { version: 1, week: 2, day: 1, completed: ['1-6'] }, moved: true, finished: false, rest: true
  });
});

test('all 612 planned sessions can be completed exactly once without an out-of-range day', () => {
  assert.equal(plan.weeks.length, 102);
  const expected = plan.weeks.flatMap(week => week.days.map(day => ({ week: week.week, day: day.day, title: day.title })));
  assert.equal(expected.length, 612);
  const progress = create(plan.weeks);
  let state = progress.defaultState();
  let restReminders = 0;
  expected.forEach((task, index) => {
    const current = progress.session(state);
    assert.equal(current.index, index);
    assert.equal(current.week.week, task.week);
    assert.equal(current.day.day, task.day);
    assert.equal(current.day.title, task.title);
    assert.equal(progress.next(state).moved, false, 'uncompleted sessions cannot be skipped by next');
    state = progress.complete(state);
    assert.equal(state.completed.length, index + 1);
    assert.equal(progress.complete(state).completed.length, index + 1);
    const result = progress.next(state);
    if (index === expected.length - 1) {
      assert.equal(result.finished, true);
      assert.equal(result.moved, false);
      assert.equal(result.rest, false);
      assert.deepEqual(plain(result.state), plain(state));
    } else {
      assert.equal(result.finished, false);
      assert.equal(result.moved, true);
      assert.equal(result.rest, expected[index + 1].week !== task.week);
      if (result.rest) restReminders += 1;
    }
    state = result.state;
  });
  assert.equal(restReminders, 101);
  assert.equal(new Set(state.completed).size, 612);
  assert.equal(state.week, 102);
  assert.equal(state.day, 6);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    assert.deepEqual(plain(progress.next(state)), { state: plain(state), moved: false, finished: true, rest: false });
  }
});

test('missing tasks and unavailable storage do not fabricate progress', () => {
  const progress = create([]);
  const initial = progress.defaultState();
  assert.equal(progress.session(initial), undefined);
  assert.deepEqual(plain(progress.complete(initial)), plain(initial));
  assert.deepEqual(plain(progress.next(initial)), { state: plain(initial), moved: false, finished: false, rest: false });
  const first = create(fixture).defaultState();
  first.completed.push('1-1');
  assert.deepEqual(plain(create(fixture).defaultState().completed), [], 'new sessions have independent progress arrays');
});
