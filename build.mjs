import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Script } from 'node:vm';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(root, 'src');

function validatePlan(plan) {
  if (plan.version !== 1 || plan.pacing?.dailyMinutes !== 45 || plan.pacing?.daysPerWeek !== 6) throw Error('规划需保持每天 45 分钟、每周 6 天');
  const resourceIds = new Set(plan.resources.map(resource => resource.id));
  if (resourceIds.size !== plan.resources.length) throw Error('资料 ID 重复');
  const phaseIds = new Set();
  let nextWeek = 1;
  for (const phase of plan.phases) {
    if (phaseIds.has(phase.id)) throw Error('阶段 ID 重复：' + phase.id);
    phaseIds.add(phase.id);
    if (['achievement', 'evidence', 'passCriteria'].some(key => typeof phase[key] !== 'string' || !phase[key].trim())) throw Error('阶段成果说明不完整：' + phase.id);
    if (!Array.isArray(phase.outcomes) || phase.outcomes.length !== 3 || ['听懂', '开口', '写出'].some((skill, index) => phase.outcomes[index]?.skill !== skill || typeof phase.outcomes[index]?.text !== 'string' || !phase.outcomes[index].text.trim())) throw Error('阶段听说写成果不完整：' + phase.id);
    if (!Number.isInteger(phase.weeks) || phase.weeks < 1 || phase.weekStart !== nextWeek || phase.weekEnd !== nextWeek + phase.weeks - 1) throw Error('阶段周次不连续：' + phase.id);
    if (phase.schedule.length !== phase.weeks || phase.schedule.some((week,index) => week.week !== nextWeek + index)) throw Error('逐周安排不完整：' + phase.id);
    if (phase.resourceIds.some(id => !resourceIds.has(id))) throw Error('资料引用缺失：' + phase.id);
    nextWeek += phase.weeks;
  }
  if (nextWeek - 1 !== plan.pacing.totalWeeks) throw Error('规划总周数不一致');
  if (!Array.isArray(plan.weeks) || plan.weeks.length !== plan.pacing.totalWeeks) throw Error('完整逐周任务缺失');
  const requiredText = (item, keys) => keys.some(key => typeof item[key] !== 'string' || !item[key].trim());
  plan.weeks.forEach((week, index) => {
    const phase = plan.phases.find(item => item.id === week.phaseId);
    if (week.week !== index + 1 || !phase || week.book !== phase.book || week.week < phase.weekStart || week.week > phase.weekEnd) throw Error('周任务所属阶段不一致：' + week.week);
    const scheduled = phase.schedule.find(item => item.week === week.week);
    if (week.lessons !== scheduled.lessons || week.kind !== scheduled.kind) throw Error('周任务课号与路线不一致：' + week.week);
    if (requiredText(week, ['title','lessons','finish','deliverable','passCriteria']) || ['learn','canDo','resourceIds'].some(key => !Array.isArray(week[key]) || !week[key].length || week[key].some(item => typeof item !== 'string' || !item.trim()))) throw Error('周任务成果或范围不完整：' + week.week);
    if (week.resourceIds.some(id => !resourceIds.has(id))) throw Error('周任务资料引用缺失：' + week.week);
    if (!Array.isArray(week.days) || week.days.length !== 6) throw Error('每周应有 6 天具体任务：' + week.week);
    week.days.forEach((day,index) => {
      if (day.day !== index + 1 || requiredText(day,['title','lessons','done','outcome']) || !Array.isArray(day.tasks) || !day.tasks.length) throw Error('每日课号、任务或成果缺失：' + week.week);
      const today=day.today;
      if (!today || requiredText(today,['goal','done','review']) || !today.listen || requiredText(today.listen,['title','instruction']) || !Array.isArray(today.listen.resourceIds) || !today.listen.resourceIds.length || today.listen.resourceIds.some(id=>!resourceIds.has(id))) throw Error('今日听读内容或完成标准缺失：' + week.week + '-' + day.day);
      if (!Array.isArray(today.phrases) || today.phrases.length!==3 || today.phrases.some(phrase=>requiredText(phrase,['en','zh']))) throw Error('今日三句表达不完整：' + week.week + '-' + day.day);
      if (day.tasks.some(task => !Number.isInteger(task.minutes) || task.minutes <= 0 || requiredText(task,['text'])) || day.tasks.reduce((sum,task) => sum + task.minutes,0) !== 45) throw Error('每天安排需合计 45 分钟：第 ' + week.week + ' 周第 ' + day.day + ' 天');
    });
  });
}

const plan = JSON.parse(await readFile(path.join(src, 'study-plan-data.json'), 'utf8'));
validatePlan(plan);
const usedResources = new Set([...plan.phases.flatMap(phase => phase.resourceIds), ...plan.weeks.flatMap(week => week.resourceIds)]);
const resourceNotes = {
  phonetics:'起步时先练常见发音，其他难点跟随课文逐步补。',
  'b1-text':'奇数课对话与偶数课句型操练配成一组。',
  'b1-video':'按课号选看课文、语法和句型疑点，每次最多 15 分钟。',
  'b1-handout':'配合正在学习的课次查阅，课号以学生用书为准。',
  'b1-audio':'固定选一套录音，先听后看，再分句跟读。',
  'b1-drill-audio':'每组第 3 天配合偶数课做替换与问答。',
  'b1-workbook':'先独立作答，再对照答案改错。',
  'b1-speaking':'起步时选 Unit 1，辅助自我介绍和简单问答。',
  'b2-text':'每课结合课文完成理解、复述和摘要任务。',
  'b2-video':'优先解决课文和语法疑点，生词与拓展按需看。',
  'b2-handout':'按 Lesson 1–96 的课号查阅对应讲义。',
  'b2-audio':'先听取事件和关键词，再逐句跟读与复述。',
  'b2-workbook':'每课选一组练习独立作答，复盘周回做错题。'
};
const viewPlan = {
  pacing:plan.pacing,sourceRoot:plan.sourceRoot,phases:plan.phases,
  weeks:plan.weeks,
  resources:plan.resources.filter(resource => usedResources.has(resource.id)).map(resource => ({...resource,note:resourceNotes[resource.id] || resource.note}))
};
const dataScript = 'window.STUDY_PLAN = ' + JSON.stringify(viewPlan) + ';\n';
const scriptFiles = ['today-progress.js','book-plan.js','app.js'];
const scripts = await Promise.all(scriptFiles.map(async file => {
  const source = await readFile(path.join(src, file), 'utf8');
  new Script(source, { filename:file });
  return source;
}));
let page = await readFile(path.join(src, 'index.html'), 'utf8');
for (const name of ['styles.css','book-plan.css']) {
  const css = await readFile(path.join(src, name), 'utf8');
  page = page.replace('<link rel="stylesheet" href="/src/' + name + '">', () => '<style>\n' + css + '\n</style>');
}
const scriptSafe = value => value.replace(/<\/script/gi, '<\\/script');
page = page.replace(/<script src="\/src\/plan-data\.js"><\/script>\s*<script src="\/src\/today-progress\.js"><\/script>\s*<script src="\/src\/book-plan\.js"><\/script>\s*<script src="\/src\/app\.js"><\/script>/, () => '<script>' + scriptSafe(dataScript) + '</script>\n<script>' + scriptSafe(scripts.join('\n')) + '</script>');
if (/<script\s+src=|<link\s+rel="stylesheet"/.test(page)) throw Error('单文件仍有外部样式或脚本引用');
await writeFile(path.join(src, 'plan-data.js'), dataScript, 'utf8');
for (const output of ['三册学习路线与规划.html','两册学习路线与规划.html','初语_学习程序.html']) await writeFile(path.join(root, output), page, 'utf8');
await mkdir(path.join(root, 'dist'), {recursive:true});
await writeFile(path.join(root, 'dist/index.html'), page, 'utf8');
console.log('构建完成：' + plan.phases.length + ' 个阶段、' + plan.weeks.length + ' 周、' + plan.weeks.reduce((sum,week) => sum + week.days.length,0) + ' 天具体任务，每天 45 分钟。');
