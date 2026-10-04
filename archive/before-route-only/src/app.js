(() => {
  'use strict';
  const COURSE = window.COURSE;
  const Review = window.ChuyuReview;
  // Isolate this rebuilt baseline from any previous app that used the documented v1 key.
  const KEY = 'chuyu8.learning.rebuilt.v1';
  const LOCK_KEY = `${KEY}.writer`;
  const RECOVERY_KEY = `${KEY}.before-import`;
  const LIMITS = { backupBytes: 5 * 1024 * 1024, writing: 12000, events: 1000 };
  const root = document.querySelector('#app');
  const toast = document.querySelector('#toast');
  let state = fresh();
  let conflict = false;
  let importCandidate = null;
  let importReadSequence = 0;
  let toastTimer;
  let memoryOnly = false;
  let blockedStore = false;
  let ownsWriterLease = false;
  const LEASE_MS = 20000;
  let persistedRaw = null;
  const reviewUI = { tab:'due', activeId:'', revealedId:'', immediateId:'', reviewed:0, visible:50 };

  function fresh() {
    return { formatId: 'chuyu-local-rebuild-v1', schemaVersion: 1, createdAt: Date.now(), profile: { dailyMinutes: 45 }, currentUnit: COURSE.units[0]?.id || '', units: {}, events: [], cards:{}, mistakes:{} };
  }
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const currentRoute = () => (location.hash.replace(/^#\/?/, '').split('/')[0] || 'home');
  const unitFor = (id) => COURSE.units.find(u => u.id === id) || COURSE.units[0];
  const progressFor = (id) => state.units[id] || (state.units[id] = { step: 0, steps: [false,false,false,false,false], listenAck: false, understandAnswer: null, understandChecked:false, speakDone: false, writing: '', writingReviewed: false, recallAnswers: ['', '', ''], recallSubmitted: false, updatedAt: Date.now() });
  const doneCount = (id) => (state.units[id]?.steps || []).filter(Boolean).length;
  const finished = (id) => doneCount(id) === 5;
  function showToast(message, bad = false) {
    toast.textContent = message; toast.classList.toggle('bad', bad); toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 3600);
  }
  function updateStorageStatus() {
    const banner = document.querySelector('#save-status');
    const message = conflict ? '另一页更新了记录，本页已暂停保存。请先导出本页内容，再重新载入最新记录。' : blockedStore ? '已有数据无法安全读取，本页暂不保存。请先下载原始数据，再从有效备份恢复。' : memoryOnly ? '本次修改尚未保存到设备。请立即导出备份，避免关页后丢失。' : '';
    banner.hidden = !message;
    banner.innerHTML = message ? `<span>${esc(message)}</span><button type="button" data-storage-action="export">导出本页数据</button>${blockedStore?'<button type="button" data-storage-action="raw">下载原始数据</button>':''}<button type="button" data-storage-action="reload">重新载入</button>` : '';
  }
  function validateState(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('备份根节点必须是对象。');
    if (data.formatId !== 'chuyu-local-rebuild-v1') throw Error('这不是当前重建版生成的备份；旧版数据未被修改。');
    if (data.schemaVersion !== 1) throw Error(`不支持 schemaVersion ${String(data.schemaVersion)}；当前数据未被修改。`);
    if (!data.profile || typeof data.profile !== 'object' || ![30,45,60,90,120].includes(data.profile.dailyMinutes)) throw Error('每日时长数据无效。');
    if (!data.units || typeof data.units !== 'object' || Array.isArray(data.units)) throw Error('练习进度数据无效。');
    const out = fresh(); out.createdAt = Number.isSafeInteger(data.createdAt) ? data.createdAt : out.createdAt;
    out.profile.dailyMinutes = data.profile.dailyMinutes;
    const validIds = new Set(COURSE.units.map(u => u.id)); const dropped = [];
    const inputUnits = Object.entries(data.units);
    if (inputUnits.length > COURSE.units.length * 4) dropped.push(`超出进度数量上限的 ${inputUnits.length - COURSE.units.length * 4} 条`);
    for (const [id, p] of inputUnits.slice(0, COURSE.units.length * 4)) {
      if (!validIds.has(id) || !p || typeof p !== 'object') { dropped.push(`无效或未知练习 ${id}`); continue; }
      const steps = Array.isArray(p.steps) ? p.steps.slice(0,5).map(x=>x===true) : [];
      while (steps.length < 5) steps.push(false);
      out.units[id] = { step: Number.isInteger(p.step) ? Math.max(0,Math.min(4,p.step)) : 0, steps, listenAck: !!p.listenAck, understandAnswer: Number.isInteger(p.understandAnswer) && p.understandAnswer >= 0 && p.understandAnswer < 3 ? p.understandAnswer : null, speakDone: !!p.speakDone, writing: typeof p.writing === 'string' ? p.writing.slice(0,LIMITS.writing) : '', writingReviewed: !!p.writingReviewed, recallAnswers: Array.isArray(p.recallAnswers) ? p.recallAnswers.slice(0,3).map(x => typeof x === 'string' ? x.slice(0,200) : '') : ['','',''], recallSubmitted: !!p.recallSubmitted, updatedAt: Number.isSafeInteger(p.updatedAt) ? p.updatedAt : Date.now() };
      while (out.units[id].recallAnswers.length < 3) out.units[id].recallAnswers.push('');
      out.units[id].understandChecked = p.understandChecked === true && out.units[id].understandAnswer !== null;
      out.units[id].recallSubmitted = p.recallSubmitted === true && out.units[id].recallAnswers.every(x=>x.trim());
      out.units[id].finishedAt = steps.every(Boolean) && Number.isSafeInteger(p.finishedAt) && p.finishedAt > 0 ? p.finishedAt : null;
      if (typeof p.writing === 'string' && p.writing.length > LIMITS.writing) dropped.push(`${id} 写作超过长度，已截取`);
    }
    out.currentUnit = validIds.has(data.currentUnit) ? data.currentUnit : COURSE.units[0]?.id || '';
    if (data.currentUnit !== out.currentUnit) dropped.push('当前练习无效，已回到第一组');
    out.events = Array.isArray(data.events) ? data.events.filter(x => x && typeof x.text === 'string' && Number.isFinite(x.at)).slice(-LIMITS.events).map(x => ({at:x.at,text:x.text.slice(0,300)})) : [];
    if (Array.isArray(data.events) && data.events.length > LIMITS.events) dropped.push(`事件超出上限，已略去 ${data.events.length - LIMITS.events} 条`);
    const review = Review.sanitizeReviewData(data, COURSE, Date.now());
    out.cards = review.cards;
    out.mistakes = review.mistakes;
    dropped.push(...review.issues);
    let added = 0;
    for (const u of COURSE.units) if (out.units[u.id]?.recallSubmitted || out.units[u.id]?.steps[4]) {
      const missing=u.words.filter((_,i)=>!Object.hasOwn(out.cards,`${u.id}-w${i}`)).length;
      if(Object.keys(out.cards).length+missing>3000){dropped.push(`${u.id} 历史复习卡未补齐：卡库容量不足，已有卡片已保留`);continue;}
      added += Review.ensureCards(out,u,Date.now(),COURSE.version).length;
    }
    if (added) dropped.push(`已为历史回忆练习补齐 ${added} 张复习卡，原有卡片排程保留`);
    return { value: out, dropped };
  }
  function save({allowRecovery=false}={}) {
    if (blockedStore && !allowRecovery) { updateStorageStatus(); showToast('已有数据无法安全读取，已暂停保存。请先保留原始数据。', true); return false; }
    if (conflict) { updateStorageStatus(); showToast('其他标签页更新了数据，本页尚未保存。', true); return false; }
    try {
      const now = Date.now();
      if (localStorage.getItem(KEY) !== persistedRaw) { conflict=true; updateStorageStatus(); showToast('设备中的记录已发生变化，本页未覆盖它。请先导出本页数据。',true); return false; }
      const lease = JSON.parse(localStorage.getItem(LOCK_KEY) || 'null');
      if (lease && lease.tab !== TAB_ID && now - lease.at < LEASE_MS) {
        conflict = true; updateStorageStatus(); showToast('另一个标签页正在编辑学习记录，本页已停止保存。', true); return false;
      }
      localStorage.setItem(LOCK_KEY, JSON.stringify({ tab: TAB_ID, at: now }));
      const claimed = JSON.parse(localStorage.getItem(LOCK_KEY) || 'null');
      if (claimed?.tab !== TAB_ID) { conflict = true; updateStorageStatus(); showToast('其他标签页同时开始编辑，本页未保存。', true); return false; }
      const serialized = JSON.stringify(state);
      localStorage.setItem(KEY, serialized);
      if (localStorage.getItem(KEY) !== serialized) { conflict=true; throw Error('写入后回读校验失败'); }
      persistedRaw = serialized;
      ownsWriterLease = true;
      memoryOnly = false;
      if (allowRecovery) blockedStore = false;
      updateStorageStatus();
      return true;
    } catch (err) {
      memoryOnly = true;
      updateStorageStatus();
      showToast(`本次记录只保存在当前页面内存中，未能写入浏览器。请立即导出备份。(${err?.name || '保存失败'})`, true);
      return false;
    }
  }
  const TAB_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      persistedRaw = raw;
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const checked = validateState(parsed);
      state = checked.value;
      if (checked.dropped.length) showToast(`已恢复有效记录；${checked.dropped.slice(0,3).join('；')}`, true);
    } catch (err) { blockedStore = true; showToast(`未能读取学习记录：${err.message} 为避免覆盖旧内容，已暂停保存。请导入有效备份或排查浏览器存储。`, true); }
  }
  const addEvent = (text) => { state.events.push({at:Date.now(),text}); state.events = state.events.slice(-LIMITS.events); };
  function startUnit(id) { if (!COURSE.units.some(u=>u.id===id)) return; state.currentUnit=id; location.hash=`study/${id}`; }
  function render() {
    const route = currentRoute();
    document.querySelectorAll('[data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === route || (route === 'study' && a.dataset.route === 'library') || (route === 'roadmap' && a.dataset.route === 'book-plan')));
    if (route === 'study') root.innerHTML = renderStudy(location.hash.split('/')[1]);
    else if (route === 'library') root.innerHTML = renderLibrary();
    else if (route === 'resources' || route === 'video') root.innerHTML = renderResources();
    else if (route === 'roadmap') root.innerHTML = renderRoadmap();
    else if (route === 'book-plan') { root.innerHTML = window.ChuyuBookPlan.render(COURSE.bookPlan); window.ChuyuBookPlan.bind(root); }
    else if (route === 'review') root.innerHTML = renderReview();
    else if (route === 'progress') root.innerHTML = renderProgress();
    else if (route === 'settings') root.innerHTML = renderSettings();
    else root.innerHTML = renderHome();
    updateStorageStatus();
  }
  function header(kicker,title,description='') { return `<header class="page-head"><div><span class="eyebrow">${esc(kicker)}</span><h1>${esc(title)}</h1>${description?`<p>${esc(description)}</p>`:''}</div></header>`; }
  function card(unit) { return `<article class="unit-card"><div class="unit-meta"><span>阶段 ${unit.stage} · ${esc(COURSE.stages.find(s=>s.id===unit.stage)?.title || '')}</span><span>${finished(unit.id)?'完成一轮':`${doneCount(unit.id)}/5 步`}</span></div><h3>${esc(unit.title)}</h3><p class="english-title">${esc(unit.enTitle)}</p><p>${esc(unit.goal)}</p><button class="button secondary" data-action="start" data-id="${esc(unit.id)}">${finished(unit.id)?'自由重练':'开始练习'} <span aria-hidden="true">→</span></button></article>`; }
  function renderResources() {
    const resources = COURSE.resources || {items:[], checkedAt:''};
    return `${header('配合教材，找到合适的学习材料','新概念资源','先看一段课，再回到初语练习。按你手中的教材版本选择资料。')}
      <section class="resource-intro"><div><span class="pill">零基础 · 从第一册开始</span><h2>先听一句，再自己说一句。</h2><p>有配套教材时，先查出版社音频说明；需要讲解时，再打开课程方的资料目录。</p></div><a class="button secondary" href="#library">回到原创练习 →</a></section>
      <section class="review-reminder local-plan-entry"><div><strong>你的两册本地资料，已经排好学习顺序</strong><p>新概念一 → 新概念二 · 每天 45 分钟，每周 6 天 · 含首周安排与资料选用清单。</p></div><a class="button primary" href="#book-plan">打开两册规划 →</a></section>
      <div class="section-head"><h2>教材、音频与课程入口</h2><span class="muted">${resources.items.length} 个来源入口</span></div>
      <div class="unit-grid">${resources.items.map(r=>`<article class="unit-card resource-card"><div class="unit-meta"><span>${esc(r.kind)}</span><span>${esc(r.books)}</span></div><h3>${esc(r.title)}</h3><p class="resource-provider">${esc(r.provider)}</p><p>${esc(r.description)}</p><p class="resource-access">${esc(r.access)}</p><a class="button secondary" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">打开来源网站 ↗</a><small>${esc(r.status)} · ${esc(resources.checkedAt)}</small></article>`).join('') || '<p>资源目录暂不可用，请重新构建项目。</p>'}</div>
      <section class="gentle-note"><span aria-hidden="true">↗</span><div><strong>在来源网站学习，在这里练习表达</strong><p>这些入口在新标签页打开。本站原创练习与教材课次没有自动对应关系。</p></div></section>`;
  }
  function renderHome() {
    const unit = unitFor(state.currentUnit);
    const allDone = COURSE.units.every(u=>finished(u.id));
    const next = !finished(unit.id) ? unit : COURSE.units.find(u=>!finished(u.id)) || unit;
    const minutes = state.profile.dailyMinutes;
    const video = Math.round(minutes / 3), practice = minutes - video;
    const parts = [Math.round(practice*2/9),Math.round(practice/9),Math.round(practice*2/9),Math.round(practice*2/9)];
    parts.push(practice-parts.reduce((a,b)=>a+b,0));
    const labels = ['听一听','弄明白','说出来','写下来','想起来'];
    const date = new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});
    return `<div class="home-toolbar"><span>${esc(date)} · 本地学习空间</span><div><a href="#book-plan">两册规划</a><a href="#settings">目标与设置 ↗</a></div></div>
      ${header('每天向前一点','今天，从一句英语开始。','听懂一点，表达一点。把今天学到的，变成自己会用的。')}
      <section class="review-reminder local-plan-entry"><div><strong>新概念一 → 新概念二</strong><p>按你的本地教材和课程安排 · 每天 45 分钟，每周 6 天。先看本周教材任务，再用下面的原创微练习补充表达。</p></div><a class="button primary" href="#book-plan">查看学习路线 →</a></section>
      <section class="hero home-hero"><div class="hero-copy"><span class="pill">${allDone?'已练完现有练习 · 可以自由重练':'今天的下一步 · '+esc(COURSE.stages.find(s=>s.id===next.stage)?.title||'')}</span><h2>${esc(next.title)}</h2><p>${esc(next.goal)}</p><button class="button primary" data-action="start" data-id="${esc(next.id)}">${allDone?'自由重练这一组':doneCount(next.id)?'继续我的练习':'开始第一步'} <span aria-hidden="true">→</span></button><div class="hero-progress"><span>${doneCount(next.id)} / 5 步已练过</span><div aria-hidden="true">${labels.map((_,i)=>`<i class="${state.units[next.id]?.steps[i]?'done':''}"></i>`).join('')}</div></div></div><div class="learning-note" aria-hidden="true"><span>今天的一句话</span><strong lang="en">${esc(next.lines[0].en)}</strong><p>${esc(next.lines[0].zh)}</p><div>慢慢来，开口就是进步。<span>↗</span></div></div></section>
      <section class="plan-card"><div class="section-head"><div><span class="eyebrow">把时间留给真正的练习</span><h2>今天的学习安排</h2></div><label class="plan-select">每天 <select id="daily-minutes" aria-label="每日学习分钟数">${[30,45,60,90,120].map(n=>`<option value="${n}" ${n===minutes?'selected':''}>${n} 分钟</option>`).join('')}</select></label></div><div class="budget-grid">${['看课',...labels].map((label,i)=>`<div><span class="budget-number">0${i+1}</span><strong>${label}</strong><span>${[video,...parts][i]} 分钟</span></div>`).join('')}</div><p class="muted">这是任务预算，可以按实际情况调整；你也可以直接开始站内练习。</p></section>
      <section class="review-reminder"><div><strong>${Review.dueCards(state,Date.now()).length} 张卡片待复习</strong><p>${Object.keys(state.cards).length?'先看看昨天学过的，今天还能不能自己想起来。':'完成一组回忆检查后，三个目标表达会进入复习。'}</p></div><a class="button secondary" href="#review">去复习 →</a></section>
      <div class="home-lower"><section class="resource-teaser"><span class="eyebrow">新概念 · 学习资料</span><h2>有教材，也有下一步。</h2><p>出版社配套音频说明、知识讲解和课程入口，集中放在这里。</p><a href="#resources">查看新概念资源 ↗</a></section><section class="progress-teaser"><span class="eyebrow">看得见的小进步</span><div><strong>${COURSE.units.filter(u=>finished(u.id)).length}<small> / ${COURSE.units.length} 组</small></strong><span>完成一轮</span></div><p>完成是学习记录；隔天还能想起，才是下一次练习的方向。</p><a href="#progress">查看学习记录 →</a></section></div>`;
  }
  function renderLibrary() { const units=COURSE.units.map(card).join(''); return `${header('PRACTICE ROOM','练习教室','每组练习都可以独立开始，也可以按路线慢慢向前。')}<div class="filter-row"><label class="search"><span aria-hidden="true">⌕</span><input id="unit-search" type="search" placeholder="搜索练习标题" aria-label="搜索练习标题"></label><select id="stage-filter" aria-label="筛选阶段"><option value="all">所有阶段</option>${COURSE.stages.map(s=>`<option value="${s.id}">阶段 ${s.id} · ${esc(s.title)}</option>`).join('')}</select></div><div id="unit-grid" class="unit-grid">${units}</div>`; }
  function renderRoadmap() { return `${header('LEARNING ROADMAP','成长路线','按能力逐步积累。阶段是学习建议，不是等级认证或分数预测。')}<div class="roadmap-list">${COURSE.stages.map(s=>{const us=COURSE.units.filter(u=>u.stage===s.id);return `<article class="stage-card"><div class="stage-number">${String(s.id).padStart(2,'0')}</div><div class="stage-body"><span class="eyebrow">${esc(s.tag)} · ${esc(s.book)}</span><h2>${esc(s.title)}</h2><p>${esc(s.ability)}</p><div class="stage-details"><span>训练重点：${esc(s.focus)}</span><span>本站练习：${us.length} 组${s.id>=3?'（微练习）':''}</span></div>${us.length?`<div class="stage-units">${us.map(u=>`<button data-action="start" data-id="${u.id}">${esc(u.title)} →</button>`).join('')}</div>`:'<p class="muted">该阶段课程尚未加入。</p>'}</div></article>`}).join('')}</div>`; }
  function renderStudy(id) {
    const u=unitFor(id), p=progressFor(u.id); state.currentUnit=u.id;
    const labels=['听一听','弄明白','说出来','写下来','想起来'];
    const step=Math.max(0,Math.min(4,p.step)); const content = [
      `<h2>先听一听，再读一遍</h2><p class="muted">这里可以先默读或使用设备朗读。确认听读是自我记录，不会检测你是否真的听过。</p><div class="sentence-list">${u.lines.map(l=>`<article><p lang="en">${esc(l.en)}</p><span>${esc(l.zh)}</span><button class="text-button" data-action="speak" data-text="${esc(l.en)}">朗读这句</button></article>`).join('')}</div><label class="check-row"><input type="checkbox" data-field="listenAck" ${p.listenAck?'checked':''}> 我已经听读或认真看过这些句子</label>`,
      `<h2>理解三个常用表达</h2><p class="muted">先看使用场景，再选出合适的答案。答错也没关系，可以重试。</p><div class="word-grid">${u.words.map(w=>`<article><strong lang="en">${esc(w.en)}</strong><span>${esc(w.zh)}</span></article>`).join('')}</div><div class="question"><strong>${esc(u.check.q)}</strong>${u.check.options.map((o,i)=>`<label class="option"><input type="radio" name="understand" value="${i}" ${p.understandAnswer===i?'checked':''}> ${esc(o)}</label>`).join('')}<button class="button secondary" data-action="check-answer" data-id="${u.id}">检查答案</button>${p.understandChecked?`<p class="feedback ${p.understandAnswer===u.check.answer?'':'feedback-warn'}">${p.understandAnswer===u.check.answer?'答对了。':'再看看句子里的提示。'} ${esc(u.check.explain)}</p>`:''}</div>`,
      `<h2>轮到你说出来</h2><p>${esc(u.speak)}</p><div class="prompt-box">试着用自己的信息替换例句中的姓名、时间或地点。不需要录音也可以完成这一步。</div><button class="button secondary" data-action="speak" data-text="${esc(u.lines[0].en)}">朗读一个参考句</button><label class="check-row"><input type="checkbox" data-field="speakDone" ${p.speakDone?'checked':''}> 我已经开口练习并完成自我检查</label>`,
      `<h2>写下来，再读给自己听</h2><p>${esc(u.write)} 最低完成门槛 ${u.minWords} 个英文词；这不代表完整写作标准。</p><textarea id="writing" maxlength="${LIMITS.writing}" placeholder="在这里写下你的句子……">${esc(p.writing)}</textarea><div class="writing-footer"><span id="word-count">英文词数：${wordCount(p.writing)} / ${u.minWords}</span><label><input type="checkbox" data-field="writingReviewed" ${p.writingReviewed?'checked':''}> 我读回并检查过自己的草稿</label></div>`,
      `<h2>合上提示，想一想</h2><p class="muted">先凭记忆回答，再检查参考答案。本站按目标表达核对文字，不评价其他合理说法。</p>${u.words.map((w,i)=>`<label class="recall-item"><span>${esc(w.zh)}</span><input data-recall="${i}" value="${esc(p.recallAnswers[i]||'')}" placeholder="试着写出英文表达" autocomplete="off"></label>`).join('')}<button class="button secondary" data-action="recall" data-id="${u.id}">检查回忆</button>${p.recallSubmitted?`<div class="recall-feedback">${u.words.map((w,i)=>`<p>${i+1}. ${esc(w.en)} <span>${normalize(p.recallAnswers[i])===normalize(w.en)?'✓ 已匹配':'再复习一次'}</span></p>`).join('')}</div>`:''}`
    ][step];
    return `${header(`UNIT ${u.id.toUpperCase()} · ${esc(COURSE.stages.find(s=>s.id===u.stage)?.title||'')}`,u.title,u.goal)}<div class="study-layout"><aside class="step-nav"><span class="eyebrow">五步练习</span>${labels.map((l,i)=>`<button class="step-link ${i===step?'selected':''} ${p.steps[i]?'complete':''}" data-action="step" data-step="${i}"><span>${p.steps[i]?'✓':`0${i+1}`}</span>${l}</button>`).join('')}</aside><section class="study-panel"><div class="study-title"><span class="eyebrow">${String(step+1).padStart(2,'0')} / 05</span><span>${p.steps[step]?'这一步练习过了':'一步一步来'}</span></div>${content}<div class="study-actions"><a href="#library" class="text-button">先离开练习</a><button class="button primary" data-action="complete-step" data-id="${u.id}">${step===4?'完成这一轮':'完成这一步并继续'} <span aria-hidden="true">→</span></button></div></section></div>`;
  }
  function wordCount(s){ return (String(s).match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)||[]).length; }
  function normalize(s){ return String(s||'').toLowerCase().replace(/[’‘]/g,"'").replace(/[.,!?;:]/g,'').replace(/\s+/g,' ').trim(); }
  function dueLabel(due) {
    return due <= Date.now() ? '现在到期' : new Date(due).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
  }
  function renderReview() {
    const now=Date.now(), due=Review.dueCards(state,now), cards=Object.values(state.cards);
    const mistakes=Object.values(state.mistakes).sort((a,b)=>Number(a.resolved)-Number(b.resolved)||(b.updatedAt||0)-(a.updatedAt||0));
    const unresolved=mistakes.filter(m=>!m.resolved).length;
    let content='';
    if(reviewUI.tab==='due') {
      const current=state.cards[reviewUI.immediateId] || due.find(c=>c.id===reviewUI.activeId) || due[0];
      if(current) {
        if(reviewUI.activeId!==current.id) reviewUI.revealedId='';
        reviewUI.activeId=current.id;
        const revealed=reviewUI.revealedId===current.id;
        const unit=COURSE.units.find(u=>u.id===current.unitId);
        content=`<article class="flashcard"><div class="unit-meta"><span>${esc(unit?.title||'自建表达卡')}</span><span>${current.due>now?'提前复习':`还有 ${due.length} 张到期`}</span></div><p class="eyebrow">先回忆这句英语怎么说</p><h2>${esc(current.zh)}</h2>${revealed?`<div class="card-answer"><p lang="en">${esc(current.en)}</p>${current.context?`<blockquote lang="en">${esc(current.context)}</blockquote>`:''}<button class="text-button" data-action="speak" data-text="${esc(current.en)}">朗读答案</button></div>`:`<button class="button primary" data-action="reveal-card" data-id="${esc(current.id)}">我想好了，查看答案</button>`}<div class="grade-buttons" aria-label="本次回忆情况">${[['again','没想起来','10 分钟后'],['hard','需要提示','1 天后'],['good','独立想起','按间隔安排']].map(([grade,label,hint])=>`<button data-action="grade-card" data-id="${esc(current.id)}" data-grade="${grade}" ${revealed?'':'disabled'}><strong>${label}</strong><span>${hint}</span></button>`).join('')}</div><p class="muted">${revealed?'按本次真实回忆情况选择；这是自评记录。':'查看答案后才能记录回忆情况。'}</p></article>`;
      } else {
        reviewUI.activeId=''; reviewUI.revealedId='';
        const next=cards.length?Math.min(...cards.map(c=>c.due)):null;
        content=`<section class="empty-panel"><div class="empty-icon">✓</div><h2>${cards.length?'这轮到期卡片复习完了':'从一个表达开始积累'}</h2><p>${next?`下次到期：${esc(dueLabel(next))}。你也可以在“全部卡片”中提前复习。`:'完成练习的回忆检查会自动生成三张卡，也可以在下方添加自己的表达。'}</p><a class="button secondary" href="#library">继续练习 →</a></section>`;
      }
    } else if(reviewUI.tab==='all') {
      const sorted=cards.sort((a,b)=>a.due-b.due||a.id.localeCompare(b.id));
      content=sorted.length?`<div class="review-list">${sorted.slice(0,reviewUI.visible).map(c=>`<article><div><strong lang="en">${esc(c.en)}</strong><p>${esc(c.zh)}</p><small>${c.unitId?esc(unitFor(c.unitId).title):'自建表达'} · 已复习 ${c.reviews} 次 · ${esc(dueLabel(c.due))}</small></div><button class="button secondary" data-action="review-now" data-id="${esc(c.id)}">立即复习</button></article>`).join('')}</div>${sorted.length>reviewUI.visible?'<button class="button secondary" data-action="review-more">显示更多</button>':''}`:'<section class="empty-panel"><h2>还没有复习卡</h2><p>完成一组回忆检查，或添加你自己的表达。</p></section>';
    } else {
      content=mistakes.length?`<div class="mistake-list">${mistakes.slice(0,reviewUI.visible).map(m=>`<article class="settings-card"><div class="unit-meta"><span>${esc(unitFor(m.unitId).title)}</span><span>${m.resolved?'已标记解决':'待复练'}</span></div><h3>${esc(m.q)}</h3><dl><dt>当时的作答</dt><dd>${esc(m.userAnswer)}</dd><dt>参考答案</dt><dd>${esc(m.answer)}</dd></dl><p>${esc(m.explain)}</p><div class="button-row"><button class="button secondary" data-action="start" data-id="${esc(m.unitId)}">回到练习</button><button class="text-button" data-action="resolve-mistake" data-id="${esc(m.id)}">${m.resolved?'重新标记待复练':'我已复练，标记解决'}</button></div><small class="muted">解决标记是自记或本题重答正确，不代表长期掌握。</small></article>`).join('')}</div>${mistakes.length>reviewUI.visible?'<button class="button secondary" data-action="review-more">显示更多</button>':''}`:'<section class="empty-panel"><h2>还没有错题记录</h2><p>理解题或目标表达回忆不匹配时，会在这里留下题目、作答和参考说明。</p></section>';
    }
    return `${header('先回忆，再看答案','复习与错题','每一次重新想起，都值得记录。复习间隔根据本次自评安排。')}<div class="review-tabs" role="group" aria-label="复习筛选">${[['due',`到期复习 ${due.length}`],['all',`全部卡片 ${cards.length}`],['mistakes',`错题 ${unresolved}`]].map(([tab,title])=>`<button data-action="review-tab" data-tab="${tab}" aria-pressed="${reviewUI.tab===tab}">${title}</button>`).join('')}</div><p class="review-summary">本次打开页面已复习 ${reviewUI.reviewed} 张 · 共 ${cards.reduce((sum,c)=>sum+c.reviews,0)} 次回忆记录</p>${content}<details class="settings-card custom-card"><summary>＋ 添加自己的表达卡</summary><form id="custom-card-form"><label>英文表达<input name="en" maxlength="120" required placeholder="例如：Could you say that again?"></label><label>中文提示或使用情境<input name="zh" maxlength="200" required placeholder="例如：没听清时，请对方再说一遍"></label><label>例句或上下文（可选）<textarea name="context" maxlength="700" rows="2"></textarea></label><button class="button primary" type="submit">加入复习</button><p class="muted">新卡会立即进入到期队列，最多保存 3,000 张卡。</p></form></details>`;
  }
  function renderProgress(){
    const events=[...state.events].reverse(),cards=Object.values(state.cards),unresolved=Object.values(state.mistakes).filter(m=>!m.resolved).length;
    return `${header('YOUR PROGRESS','学习记录','记录你做过的练习，不把练习次数当成英语水平。')}<div class="metric-row"><article class="metric"><span class="eyebrow">练习完成</span><strong>${COURSE.units.filter(u=>finished(u.id)).length}<small> / ${COURSE.units.length}</small></strong><span>组完成五步练习</span></article><article class="metric"><span class="eyebrow">表达复习</span><strong>${cards.reduce((sum,c)=>sum+c.reviews,0)}<small> 次</small></strong><span>${cards.length} 张表达卡的回忆记录</span></article><article class="metric"><span class="eyebrow">错题复练</span><strong>${unresolved}<small> 条</small></strong><a href="#review">待复练 · 前往复习与错题 →</a></article></div><section class="event-list"><h2>最近记录</h2><p class="muted">保留最近 ${LIMITS.events} 条学习事件，当前展示最新 30 条。</p>${events.length?events.slice(0,30).map(e=>`<p><time>${new Date(e.at).toLocaleString('zh-CN')}</time>${esc(e.text)}</p>`).join(''):'<p class="muted">完成练习或复习后，这里会显示你的本机记录。</p>'}</section>`;
  }
  function renderSettings(){
    const status=conflict?'保存已暂停：另一页更新了记录，请先导出本页内容。':blockedStore?'保存已暂停：已有数据无法安全读取，请保留原始数据。':memoryOnly?'上次保存失败：本页修改尚未写入设备，请立即导出。':persistedRaw===null?'尚无已保存记录；开始练习后会自动保存。':'当前记录已保存到本机浏览器。';
    return `${header('LOCAL DATA','数据与设置','没有账号或云同步。建议定期下载备份并妥善保管。')}<section class="settings-card"><h2>每日学习时间</h2><p>首页会用这个时长展示当天计划。</p><select id="daily-minutes" aria-label="每日学习时间">${[30,45,60,90,120].map(n=>`<option value="${n}" ${state.profile.dailyMinutes===n?'selected':''}>每天 ${n} 分钟</option>`).join('')}</select></section><section class="settings-card"><h2>学习数据备份</h2><p>备份包含设置、练习进度、写作草稿、复习卡排程和错题记录。请妥善保存，避免公开分享。</p><div class="button-row"><button class="button secondary" data-action="export">下载 JSON 备份</button><label class="button secondary file-button">预览并导入<input id="import-file" type="file" accept="application/json,.json" aria-label="选择 JSON 学习备份"></label></div><div id="import-preview"></div><p class="storage-state ${conflict||blockedStore||memoryOnly?'error':''}">${status}</p></section><section class="settings-card"><h2>导入前的数据</h2><p>每次确认导入时，先保留旧记录快照并发起下载。这里可以再次下载最近一次导入前的内容；请查看文件后再决定是否恢复。</p><button class="button secondary" data-action="export-recovery">下载上次导入前的快照</button></section><section class="settings-card"><h2>资源入口</h2><p>新概念资料页收录出版社和课程方的公开入口。选择与你手中教材匹配的资料。</p><a href="#resources">查看新概念资源 →</a></section><section class="settings-card"><h2>版本说明</h2><p>当前有 ${COURSE.units.length} 组原创练习。视频播放器、录音、完整 30 组课程和云同步仍在后续范围中。</p><p class="muted">数据版本 1 · 课程内容版本 ${COURSE.version}</p></section>`;
  }

  function focusReview(selector) { root.querySelector(selector)?.focus({preventScroll:true}); }

  root.addEventListener('click', async (event) => {
    const btn=event.target.closest('[data-action]'); if(!btn)return;
    const action=btn.dataset.action, id=btn.dataset.id;
    if(action==='review-tab'){reviewUI.tab=btn.dataset.tab;reviewUI.activeId='';reviewUI.revealedId='';reviewUI.immediateId='';reviewUI.visible=50;render();focusReview('[data-action="review-tab"][aria-pressed="true"]');return;}
    if(action==='review-more'){reviewUI.visible+=50;render();return;}
    if(action==='review-now'){if(!state.cards[id])return;reviewUI.tab='due';reviewUI.immediateId=id;reviewUI.activeId=id;reviewUI.revealedId='';render();focusReview('[data-action="reveal-card"]');return;}
    if(action==='reveal-card'){if(id===reviewUI.activeId){reviewUI.revealedId=id;render();focusReview('[data-action="grade-card"]');}return;}
    if(action==='grade-card'){
      try {
        const graded=Review.gradeCard(state,id,btn.dataset.grade,{revealed:id===reviewUI.activeId&&id===reviewUI.revealedId,now:Date.now()});
        addEvent(`复习「${graded.en}」：${{again:'没想起来',hard:'需要提示',good:'独立想起'}[btn.dataset.grade]}`);
        reviewUI.reviewed++;reviewUI.activeId='';reviewUI.revealedId='';reviewUI.immediateId='';
        const saved=save();render();focusReview('[data-action="reveal-card"], .empty-panel a');if(saved)showToast(`已记录，下次复习：${dueLabel(graded.due)}`);
      } catch(err){showToast(err.message,true);}return;
    }
    if(action==='resolve-mistake'){const m=state.mistakes[id];if(!m)return;m.resolved=!m.resolved;m.updatedAt=Date.now();m.resolvedAt=m.resolved?Date.now():null;addEvent(`${m.resolved?'自行标记解决':'重新标记待复练'}：${m.q}`);const saved=save();render();if(saved)showToast('已更新错题记录。');return;}
    if(action==='start'){startUnit(id);return;}
    if(action==='step'){const p=progressFor(unitFor(location.hash.split('/')[1]).id);p.step=Number(btn.dataset.step);save();render();return;}
    if(action==='check-answer'){
      const u=unitFor(id),p=progressFor(id),selected=root.querySelector('input[name="understand"]:checked');
      if(!selected){showToast('先选择一个答案。',true);return;}
      try {Review.recordMistake(state,{id:`${id}-check`,unitId:id,q:u.check.q,answer:u.check.options[u.check.answer],userAnswer:u.check.options[Number(selected.value)],explain:u.check.explain,correct:Number(selected.value)===u.check.answer},Date.now());}
      catch(err){showToast(err.message,true);return;}
      p.understandAnswer=Number(selected.value);p.understandChecked=true;p.updatedAt=Date.now();
      if(p.understandAnswer!==u.check.answer)addEvent(`${u.title}：理解题已加入错题`);save();render();return;
    }
    if(action==='complete-step'){const u=unitFor(id),p=progressFor(id),s=p.step;
      if(s===0&&!p.listenAck){showToast('先勾选你已经听读或认真看过句子。',true);return;}
      if(s===1&&(!p.understandChecked||p.understandAnswer!==u.check.answer)){showToast('请先检查理解题答案并答对；可以重试。',true);return;}
      if(s===2&&!p.speakDone){showToast('完成口头练习并勾选自我检查后再继续。',true);return;}
      if(s===3&&(wordCount(p.writing)<u.minWords||!p.writingReviewed)){showToast(`写作至少 ${u.minWords} 个英文词，并勾选读回自查后再继续。`,true);return;}
      if(s===4&&!p.recallSubmitted){showToast('先完成三条表达的回忆检查。',true);return;}
      p.steps[s]=true;p.updatedAt=Date.now();addEvent(`${u.title}：完成「${['听一听','弄明白','说出来','写下来','想起来'][s]}」`);
      if(p.steps.every(Boolean)&&!p.finishedAt){p.finishedAt=Date.now();addEvent(`${u.title}：首次完成一轮练习`);}
      if(s<4)p.step=s+1;
      const saved=save();
      if(s===4&&p.steps.every(Boolean)&&saved){reviewUI.tab='due';reviewUI.activeId='';reviewUI.revealedId='';reviewUI.immediateId='';location.hash='review';showToast('已完成一轮，三个目标表达可以开始复习。');}else render();return;
    }
    if(action==='recall'){
      const u=unitFor(id),p=progressFor(id);if(p.recallAnswers.some(x=>!String(x).trim())){showToast('请先填写三条表达，再检查回忆。',true);return;}
      const now=Date.now(), draft={cards:{...state.cards},mistakes:JSON.parse(JSON.stringify(state.mistakes))};let matches=0;
      try {
        Review.ensureCards(draft,u,now,COURSE.version);
        u.words.forEach((w,i)=>{const correct=normalize(p.recallAnswers[i])===normalize(w.en);if(correct)matches++;Review.recordMistake(draft,{id:`${id}-recall${i}`,unitId:id,q:`回忆本组目标表达：${w.zh}`,answer:w.en,userAnswer:p.recallAnswers[i],explain:'本题核对本组目标表达；其他合理说法不代表英语错误。',correct},now);});
      } catch(err){showToast(err.message,true);return;}
      state.cards=draft.cards;state.mistakes=draft.mistakes;p.recallSubmitted=true;p.updatedAt=now;addEvent(`${u.title}：回忆检查匹配 ${matches}/3，表达卡已进入复习`);save();render();return;
    }
    if(action==='speak'){if(!('speechSynthesis'in window)){showToast('此浏览器不支持系统朗读；你仍可以自己读出句子。',true);return;}window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(btn.dataset.text);utterance.lang='en-GB';window.speechSynthesis.speak(utterance);return;}
    if(action==='export'){exportBackup();return;}
    if(action==='export-recovery'){exportRecovery();return;}
    if(action==='confirm-import'){commitImport();return;}
    if(action==='cancel-import'){importReadSequence++;importCandidate=null;render();return;}
    if(action==='clear-filter'){const q=root.querySelector('#unit-search'),s=root.querySelector('#stage-filter');if(q)q.value='';if(s)s.value='all';filterUnits();return;}
  });
  root.addEventListener('change',event=>{
    const t=event.target;
    if(t.id==='stage-filter'||t.id==='unit-search'){filterUnits();return;}
    if(t.id==='daily-minutes'){state.profile.dailyMinutes=Number(t.value);addEvent(`更新每日计划为 ${t.value} 分钟`);save();render();return;}
    if(t.id==='import-file'){previewImport(t.files?.[0]);t.value='';return;}
    if(currentRoute()!=='study')return;
    const unitId=location.hash.split('/')[1],p=progressFor(unitFor(unitId).id);
    if(t.dataset.field){p[t.dataset.field]=t.type==='checkbox'?t.checked:t.value;p.updatedAt=Date.now();save();if(t.dataset.field==='listenAck'||t.dataset.field==='speakDone'||t.dataset.field==='writingReviewed')return;}
    if(t.name==='understand'){p.understandAnswer=Number(t.value);p.understandChecked=false;root.querySelector('.feedback')?.remove();save();}
  });
  root.addEventListener('input',event=>{
    const t=event.target;
    if(t.id==='unit-search'){filterUnits();return;}
    if(currentRoute()!=='study')return;
    const unitId=location.hash.split('/')[1],p=progressFor(unitFor(unitId).id);
    if(t.id==='writing'){p.writing=t.value.slice(0,LIMITS.writing);p.writingReviewed=false;const ack=root.querySelector('[data-field="writingReviewed"]');if(ack)ack.checked=false;p.updatedAt=Date.now();const c=root.querySelector('#word-count');if(c)c.textContent=`英文词数：${wordCount(p.writing)} / ${unitFor(unitId).minWords}`;save();}
    if(t.dataset.recall!==undefined){p.recallAnswers[Number(t.dataset.recall)]=t.value.slice(0,200);p.recallSubmitted=false;root.querySelector('.recall-feedback')?.remove();p.updatedAt=Date.now();save();}
  });
  root.addEventListener('submit',event=>{
    if(event.target.id!=='custom-card-form')return;
    event.preventDefault();
    const form=event.target;if(!form.reportValidity())return;
    const fields=new FormData(form),en=String(fields.get('en')||'').trim(),zh=String(fields.get('zh')||'').trim(),context=String(fields.get('context')||'').trim();
    if(!en||!zh){showToast('请填写英文表达和中文提示，不能只输入空格。',true);return;}
    if(en.length>120||zh.length>200||context.length>700){showToast('内容超过长度限制，请缩短后重试。',true);return;}
    if(Object.keys(state.cards).length>=3000){showToast('已达到 3,000 张卡片上限，请先备份整理。',true);return;}
    const now=Date.now();let id;
    do{id=`c-${now}-${Math.random().toString(36).slice(2,11)}`;}while(Object.hasOwn(state.cards,id));
    state.cards[id]={id,en,zh,context,unitId:null,wordIndex:null,due:now,level:0,reviews:0,createdAt:now,lastGrade:null,lastReviewed:null,algorithmVersion:1,contentVersion:1};
    addEvent(`添加自建表达卡：${en}`);
    reviewUI.tab='due';reviewUI.immediateId=id;reviewUI.activeId=id;reviewUI.revealedId='';
    const saved=save();render();if(saved)showToast('表达已加入复习。');
  });
  document.querySelector('#save-status').addEventListener('click',event=>{
    const action=event.target.closest('[data-storage-action]')?.dataset.storageAction;
    if(action==='export')exportBackup();
    if(action==='raw'&&persistedRaw!==null)downloadData(persistedRaw,'初语-原始存储.json');
    if(action==='reload'&&window.confirm('重新载入会放弃本页尚未保存的修改。请确认已导出需要保留的数据。'))location.reload();
  });
  function filterUnits(){const grid=root.querySelector('#unit-grid');if(!grid)return;const q=(root.querySelector('#unit-search')?.value||'').trim().toLowerCase(), stage=root.querySelector('#stage-filter')?.value||'all';const matches=COURSE.units.filter(u=>(stage==='all'||String(u.stage)===stage)&&`${u.title} ${u.enTitle} ${u.goal}`.toLowerCase().includes(q));grid.innerHTML=matches.length?matches.map(card).join(''):'<div class="empty-panel"><h2>没有找到练习</h2><p>试试更短的关键词，或切换到所有阶段。</p><button class="button secondary" data-action="clear-filter">清除筛选</button></div>';}
  function downloadData(text,name) {
    try {
      const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');
      a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);return true;
    } catch(err){showToast(`无法生成下载文件：${err.message}`,true);return false;}
  }
  function exportBackup(){const ok=downloadData(JSON.stringify(state,null,2),`初语学习备份-${new Date().toISOString().slice(0,10)}.json`);if(ok)showToast('已生成备份，请在浏览器下载记录中确认文件。');return ok;}
  function exportRecovery(){try{const saved=JSON.parse(localStorage.getItem(RECOVERY_KEY)||'null');if(!saved){showToast('还没有导入前快照。');return;}if(downloadData(saved.recovery,'初语-上一次导入前.json'))showToast('已生成上一次导入前的数据文件。');}catch(err){showToast(`无法读取导入前快照：${err.message}`,true);}}
  async function previewImport(file){
    const sequence=++importReadSequence;
    importCandidate=null;
    const previousPreview=root.querySelector('#import-preview');if(previousPreview)previousPreview.innerHTML='';
    if(!file)return;
    if(file.size>LIMITS.backupBytes){showToast('备份文件超过 5 MiB 上限，未作任何更改。',true);return;}
    try{
      const raw=await file.text();
      if(sequence!==importReadSequence||currentRoute()!=='settings')return;
      const checked=validateState(JSON.parse(raw));
      importCandidate={value:checked.value,dropped:checked.dropped,name:file.name};render();
      const box=root.querySelector('#import-preview');
      if(box)box.innerHTML=`<div class="import-report"><strong>备份预览 · ${esc(file.name)}</strong><p>将替换当前记录：${Object.keys(checked.value.units).length} 组练习进度、${Object.keys(checked.value.cards).length} 张复习卡、${Object.keys(checked.value.mistakes).length} 条错题、${checked.value.events.length} 条学习事件。</p><p>替换前会在本机保留快照并发起旧数据下载；请确认浏览器保存了文件。</p>${checked.dropped.length?`<p class="feedback-warn">校验与迁移说明（${checked.dropped.length} 项）：</p><ul>${checked.dropped.slice(0,20).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p>未发现需要修正或丢弃的条目。</p>'}<div class="button-row"><button class="button primary" data-action="confirm-import">备份旧数据并确认替换</button><button class="button secondary" data-action="cancel-import">取消</button></div></div>`;
    }catch(err){if(sequence!==importReadSequence)return;importCandidate=null;showToast(`备份未导入，当前数据未更改：${err.message}`,true);}
  }
  function commitImport(){
    if(!importCandidate)return;
    let snapshot;
    try {
      const lease=JSON.parse(localStorage.getItem(LOCK_KEY)||'null');
      if(conflict||localStorage.getItem(KEY)!==persistedRaw||(lease&&lease.tab!==TAB_ID&&Date.now()-lease.at<LEASE_MS)){conflict=true;updateStorageStatus();showToast('其他标签页可能已更新记录，导入已取消；请先重新载入。',true);return;}
      snapshot={at:Date.now(),raw:persistedRaw,recovery:blockedStore&&persistedRaw!==null?persistedRaw:JSON.stringify(state,null,2)};
      const serialized=JSON.stringify(snapshot);localStorage.setItem(RECOVERY_KEY,serialized);
      if(localStorage.getItem(RECOVERY_KEY)!==serialized)throw Error('快照回读失败');
      if(!downloadData(snapshot.recovery,'初语-本次导入前.json'))return;
    }catch(err){showToast(`无法创建旧数据快照，导入已停止：${err.message}`,true);return;}
    const old=state;state=importCandidate.value;addEvent('从已预览的备份替换学习记录');
    const attempted=JSON.stringify(state);
    if(!save({allowRecovery:true})){
      state=old;importCandidate=null;
      try{if(localStorage.getItem(KEY)===attempted){if(snapshot.raw===null)localStorage.removeItem(KEY);else localStorage.setItem(KEY,snapshot.raw);}}catch{}
      render();showToast('导入未确认保存成功；旧数据保留在本页和导入前快照中。',true);return;
    }
    importCandidate=null;reviewUI.tab='due';reviewUI.activeId='';reviewUI.revealedId='';reviewUI.immediateId='';reviewUI.reviewed=0;location.hash='home';render();showToast('备份已写入本机；导入前快照仍可下载。');
  }
  window.addEventListener('storage',event=>{
    try {
      const changed=event.key===null||event.key===KEY||(event.key===LOCK_KEY&&event.newValue&&JSON.parse(event.newValue)?.tab!==TAB_ID);
      if(changed){const first=!conflict;conflict=true;ownsWriterLease=false;updateStorageStatus();if(first)showToast('其他标签页更新了记录，本页已暂停保存。',true);}
    }catch{conflict=true;updateStorageStatus();}
  });
  window.addEventListener('hashchange',()=>{importReadSequence++;importCandidate=null;reviewUI.activeId='';reviewUI.revealedId='';reviewUI.immediateId='';render();});
  window.addEventListener('beforeunload',()=>{if(ownsWriterLease){try{const lease=JSON.parse(localStorage.getItem(LOCK_KEY)||'null');if(lease?.tab===TAB_ID)localStorage.removeItem(LOCK_KEY);}catch{}}});
  function boot(){
    load();
    if(!COURSE.units.length){root.innerHTML='<p>课程暂不可用，请修复课程数据。</p>';return;}
    try {
      const lease=JSON.parse(localStorage.getItem(LOCK_KEY)||'null');
      if(lease&&lease.tab!==TAB_ID&&Date.now()-lease.at<LEASE_MS){conflict=true;showToast('检测到另一个标签页可能正在编辑。请关闭重复页面或等待后重新载入。',true);}
      else if(!blockedStore){localStorage.setItem(LOCK_KEY,JSON.stringify({tab:TAB_ID,at:Date.now()}));ownsWriterLease=true;}
    }catch{memoryOnly=true;}
    setInterval(()=>{
      if(!ownsWriterLease||conflict)return;
      try {
        const lease=JSON.parse(localStorage.getItem(LOCK_KEY)||'null');
        if(lease?.tab===TAB_ID)localStorage.setItem(LOCK_KEY,JSON.stringify({tab:TAB_ID,at:Date.now()}));
        else{conflict=true;ownsWriterLease=false;updateStorageStatus();showToast('编辑权已交给另一个标签页。本页暂停保存。',true);}
      }catch{memoryOnly=true;updateStorageStatus();}
    },Math.floor(LEASE_MS/3));
    render();
  }
  boot();
})();

