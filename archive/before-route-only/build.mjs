import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Script } from 'node:vm';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(root, 'src');
const course = JSON.parse(await readFile(path.join(src, 'course-data.json'), 'utf8'));

export function validateCourse(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ['课程根节点必须是对象'];
  if (data.version !== 1) errors.push('课程 version 必须为 1');
  if (!Array.isArray(data.stages) || !data.stages.length) errors.push('stages 必须是非空数组');
  if (!Array.isArray(data.units) || !data.units.length) errors.push('units 必须是非空数组');
  const stages = Array.isArray(data.stages) ? data.stages : [];
  const units = Array.isArray(data.units) ? data.units : [];
  const stageIds = stages.map(s => s?.id);
  if (new Set(stageIds).size !== stageIds.length) errors.push('阶段 id 必须唯一');
  for (const [i, s] of stages.entries()) {
    if (!s || typeof s !== 'object' || ['title','short','label','book','focus','ability','next','tag'].some(k => typeof s[k] !== 'string' || !s[k].trim())) errors.push(`阶段索引 ${i} 缺少必填文本字段`);
  }
  const seen = new Set();
  for (const [i, u] of units.entries()) {
    const at = `练习索引 ${i}`;
    if (!u || typeof u !== 'object' || Array.isArray(u)) { errors.push(`${at} 必须是对象`); continue; }
    if (typeof u.id !== 'string' || !/^u\d{2,}$/.test(u.id)) errors.push(`${at} id 必须使用稳定格式 u01、u100`);
    else if (seen.has(u.id)) errors.push(`练习 ID 重复：${u.id}`); else seen.add(u.id);
    if (!stageIds.includes(u.stage)) errors.push(`${at} 引用了不存在的阶段`);
    for (const k of ['title','enTitle','goal','note','speak','write']) if (typeof u[k] !== 'string' || !u[k].trim()) errors.push(`${at}.${k} 必须是非空文本`);
    if (!Array.isArray(u.lines) || !u.lines.length || u.lines.some(x => !x?.en || !x?.zh)) errors.push(`${at}.lines 必须包含中英文句子`);
    if (!Array.isArray(u.words) || u.words.length !== 3 || u.words.some(x => !x?.en || !x?.zh)) errors.push(`${at}.words 必须恰好包含三条中英文表达`);
    if (!Number.isInteger(u.minWords) || u.minWords < 1) errors.push(`${at}.minWords 必须是正整数`);
    for (const k of ['check','readingQuiz']) { const q=u[k]; if (!q?.q || !q?.explain || !Array.isArray(q.options) || q.options.length!==3 || q.options.some(x=>typeof x!=='string'||!x.trim()) || !Number.isInteger(q.answer) || q.answer<0 || q.answer>2) errors.push(`${at}.${k} 题干、三项选项、答案索引或解释无效`); }
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  course.resources = JSON.parse(await readFile(path.join(src, 'resource-data.json'), 'utf8'));
  course.bookPlan = JSON.parse(await readFile(path.join(src, 'study-plan-data.json'), 'utf8'));
  const plan = course.bookPlan;
  if (plan.version !== 1 || plan.pacing.dailyMinutes !== 45 || plan.pacing.daysPerWeek !== 6) throw new Error('两册规划需保持用户确认的每天 45 分钟、每周 6 天');
  let planWeek = 1;
  const resourceIds = new Set(plan.resources.map(r => r.id));
  for (const phase of plan.phases) {
    if (!Number.isInteger(phase.weeks) || phase.weeks < 1 || phase.weekStart !== planWeek || phase.weekEnd !== planWeek + phase.weeks - 1) throw new Error(`规划周次不连续：${phase.id}`);
    if (phase.resourceIds.some(id => !resourceIds.has(id))) throw new Error(`规划资料引用缺失：${phase.id}`);
    planWeek += phase.weeks;
  }
  if (planWeek - 1 !== plan.pacing.totalWeeks) throw new Error('规划总周数不一致');
  for (const days of [plan.firstWeek, ...plan.weekTemplates.map(week => week.days)]) {
    if (days.length !== 6 || days.some(day => day.tasks.reduce((sum, task) => sum + task.minutes, 0) !== 45)) throw new Error('每周需有 6 个学习日，每日安排合计 45 分钟');
  }
  for (const item of course.resources.items) {
    const url = new URL(item.url);
    if (url.protocol !== 'https:' || !['www.unischool.cn', 'bj.xdf.cn'].includes(url.hostname)) throw new Error(`资源地址未通过检查：${item.id}`);
  }
  const errors = validateCourse(course);
  if (errors.length) throw new Error(`课程校验失败：\n- ${errors.join('\n- ')}`);
  const htmlPath = path.join(src, 'index.html');
  let page = await readFile(htmlPath, 'utf8');
  const styles = await readFile(path.join(src, 'styles.css'), 'utf8');
  const design = await readFile(path.join(src, 'design.css'), 'utf8');
  const app = await readFile(path.join(src, 'app.js'), 'utf8');
  const reviewDomain = await readFile(path.join(src, 'review-domain.js'), 'utf8');
  const bookPlanScript = await readFile(path.join(src, 'book-plan.js'), 'utf8');
  const bookPlanStyles = await readFile(path.join(src, 'book-plan.css'), 'utf8');
  // Reject invalid browser scripts before replacing the standalone artifact.
  new Script(reviewDomain, { filename: 'review-domain.js' });
  new Script(app, { filename: 'app.js' });
  new Script(bookPlanScript, { filename: 'book-plan.js' });
  const scriptSafe = value => value.replace(/<\/script/gi, '<\\/script');
  page = page.replace('  <link rel="stylesheet" href="/src/styles.css">', `  <style>\n${styles}\n  </style>`);
  page = page.replace('  <link rel="stylesheet" href="/src/design.css">', `  <style>\n${design}\n  </style>`);
  page = page.replace('  <link rel="stylesheet" href="/src/book-plan.css">', `  <style>\n${bookPlanStyles}\n  </style>`);
  page = page.replace(/<script src="\/src\/content\.js"><\/script>\s*<script src="\/src\/review-domain\.js"><\/script>\s*<script src="\/src\/book-plan\.js"><\/script>\s*<script src="\/src\/app\.js"><\/script>/, () => `<script>${scriptSafe(`window.COURSE = ${JSON.stringify(course)};`)}</script>\n  <script>${scriptSafe(reviewDomain + '\n' + bookPlanScript + '\n' + app)}</script>`);
  if (/<script\s+src=/.test(page)) throw new Error('单文件构建失败：仍存在外部脚本引用');
  await writeFile(path.join(src, 'content.js'), `window.COURSE = ${JSON.stringify(course)};\n`, 'utf8');
  const output = path.join(root, '初语_学习程序.html');
  await writeFile(output, page, 'utf8');
  const planPage = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>新概念一、二册学习路线与规划</title><style>${styles}\n${bookPlanStyles}\nmain{margin:0 auto;max-width:1240px;padding:36px 28px 70px}.plan-standalone-link{display:inline-block;margin-bottom:20px;font-size:13px}@media(max-width:680px){main{padding:24px 16px 50px}}@media print{.plan-standalone-link{display:none}}</style></head><body><main id="book-plan"><a class="plan-standalone-link" href="./初语_学习程序.html#book-plan">打开初语学习程序 →</a><div id="plan-content"></div></main><script>${scriptSafe(bookPlanScript)}\nconst planData=${scriptSafe(JSON.stringify(plan))};const planRoot=document.querySelector('#plan-content');planRoot.innerHTML=window.ChuyuBookPlan.render(planData).replaceAll('href="#roadmap"','href="./初语_学习程序.html#roadmap"');window.ChuyuBookPlan.bind(planRoot);</script></body></html>`;
  await writeFile(path.join(root, '两册学习路线与规划.html'), planPage, 'utf8');
  console.log(`课程校验通过：${course.stages.length} 个阶段，${course.units.length} 组练习。已生成 ${path.basename(output)}`);
}
