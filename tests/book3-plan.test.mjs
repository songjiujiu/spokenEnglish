import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
const readJSON=async name=>JSON.parse(await readFile(new URL('../'+name,import.meta.url),'utf8'));
const plan=await readJSON('src/study-plan-data.json');
const catalog=await readJSON('planning/book3-lesson-map.json');
const baseline=await readJSON('planning/book3-existing-route-baseline.json');
const window={};
runInNewContext(await readFile(new URL('../src/today-progress.js',import.meta.url),'utf8'),{window});
const progress=window.ChuyuTodayProgress.create(plan.weeks);

test('adding book three preserves every existing day and resumes after book two',()=>{
  assert.equal(createHash('sha256').update(JSON.stringify(plan.weeks.slice(0,baseline.weeks))).digest('hex'),baseline.sha256);
  const completed=plan.weeks.slice(0,102).flatMap(week=>week.days.map(day=>`${week.week}-${day.day}`));
  const saved={version:1,week:102,day:6,completed};
  const resumed=progress.sanitize(saved);
  assert.equal(resumed.completed.length,612);
  assert.equal(resumed.week,102);
  const next=progress.next(resumed);
  assert.equal(next.state.week,103);
  assert.equal(next.state.day,1);
  assert.equal(next.rest,true);
  assert.equal(next.finished,false);
  assert.equal(next.state.completed.length,612);
  assert.equal(progress.isCompleted(next.state),false);
  const jumped=progress.locate(progress.defaultState(),103,1);
  assert.equal(jumped.completed.length,0);
});

test('third book covers each of sixty lessons once with six ten-lesson reviews',()=>{
  const weeks=plan.weeks.filter(week=>week.book==='book3');
  assert.equal(plan.pacing.totalWeeks,168);
  assert.equal(weeks.length,66);
  assert.equal(weeks[0].week,103);
  assert.equal(weeks.at(-1).week,168);
  const teaching=weeks.filter(week=>week.kind==='学习');
  assert.deepEqual(teaching.map(week=>Number(/^L(\d+)/.exec(week.lessons)[1])),Array.from({length:60},(_,i)=>i+1));
  assert.deepEqual(weeks.filter(week=>week.kind==='复盘').map(week=>week.week),[113,124,135,146,157,168]);
  for(const week of teaching) {
    const lesson=Number(/^L(\d+)/.exec(week.lessons)[1]);
    for(const day of week.days) {
      assert.match(day.lessons,new RegExp(`第三册 L${lesson}《`));
      assert.deepEqual(day.today.listen.lessons,[{book:'book3',lesson}]);
      assert.deepEqual(day.today.listen.resourceIds,['b3-audio']);
      assert.equal(day.today.listen.optional,day.day>=4);
    }
  }
  for(const [index,week] of weeks.filter(week=>week.kind==='复盘').entries()) {
    const covered=week.days.slice(0,3).flatMap(day=>{const [,a,b]=/L(\d+)–(\d+)/.exec(day.lessons);return Array.from({length:Number(b)-Number(a)+1},(_,i)=>Number(a)+i);});
    assert.deepEqual(covered,Array.from({length:10},(_,i)=>index*10+i+1));
    for(const day of week.days) for(const item of day.today.listen.lessons) assert.ok(item.lesson>=index*10+1 && item.lesson<=index*10+10);
  }
});

test('the source corrections, book boundaries and final writing requirement are retained',()=>{
  assert.equal(catalog.units.length,60);
  assert.match(catalog.units[6].parts[1],/钱包.*鉴定/);
  assert.match(catalog.units[46].title,/Too high a price/);
  assert.match(catalog.units[50].title,/Predicting the future/);
  for(const [lesson,page] of [[1,16],[20,92],[21,108],[40,184],[41,194],[60,270]]) assert.equal(catalog.units[lesson-1].pdfPageStart,page);
  assert.match(catalog.units[59].writing,/250–350/);
  assert.match(catalog.units[59].writing,/只写末段/);
  for(const unit of catalog.units) {
    assert.match(unit.audioPath,/新概念三\/.*英音-/);
    assert.equal(Number(/\/(\d+)[^/]*\.mp3$/.exec(unit.audioPath)[1]),unit.start);
    assert.equal(unit.phrases.length,3);
  }
});
