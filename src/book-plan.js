/* Daily progress is explicit. Browsing the route never completes a lesson. */
(function () {
  'use strict';

  const STORAGE_KEY = 'chuyu-today-v1';
  const boundPages = new WeakSet();
  const renderedPlans = new Map();
  let renderId = 0;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const list = value => Array.isArray(value) ? value : [];
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const text = value => Array.isArray(value) ? value.join('、') : String(value ?? '');

  function bookLabel(value) {
    const raw = String(value ?? '').toLowerCase();
    if (raw === 'book1' || raw === '1' || /第一册|一册/.test(raw)) return '第一册';
    if (raw === 'book2' || raw === '2' || /第二册|二册/.test(raw)) return '第二册';
    return '两册通用';
  }

  function fullPath(sourceRoot, relativePath) {
    const path = String(relativePath ?? '');
    if (/^[a-z]:[\\/]|^\\\\|^\//i.test(path)) return path;
    return `${String(sourceRoot ?? '').replace(/[\\/]+$/, '')}\\${path.replace(/^[\\/]+/, '').replace(/\//g, '\\')}`;
  }

  function bulletList(items) {
    return `<ul>${list(items).map(item => `<li>${esc(item)}</li>`).join('')}</ul>`;
  }

  function resourcesFor(model, ids) {
    return list(ids).map(id => model.resources.find(resource => String(resource.id) === String(id))).filter(Boolean);
  }

  function resourceLinks(model, ids) {
    return resourcesFor(model, ids).map(resource => {
      const index = model.resources.indexOf(resource);
      return `<a href="#bp-resource-${index}" data-plan-resource="bp-resource-${index}">${esc(resource.title)}</a>`;
    }).join('');
  }

  function taskSteps(day, open = false) {
    const total = list(day.tasks).reduce((sum, task) => sum + number(task.minutes), 0);
    return `<details class="bp-day-steps"${open ? ' open' : ''}><summary>${esc(total)} 分钟怎么安排<span>${list(day.tasks).length} 步</span></summary><ol class="bp-task-list">${list(day.tasks).map(task => `<li><span class="bp-task-minutes">${esc(task.minutes)}<small>分钟</small></span><span>${esc(task.text)}</span></li>`).join('')}</ol></details>`;
  }

  function todayPanel(model) {
    const session = model.progress.session(model.state);
    if (!session?.week || !session?.day) return '<p class="bp-empty">今日任务尚未载入，请刷新页面。</p>';
    const { week, day } = session;
    const today = day.today || {};
    const listen = today.listen || {};
    const phrases = list(today.phrases);
    const completed = model.progress.isCompleted(model.state);
    const position = model.weeks.indexOf(week);
    const finalDay = position === model.weeks.length - 1 && model.state.day === list(week.days).length;
    const allDone = model.state.completed.length === model.totalDays;
    const nextLabel = model.state.day === list(week.days).length ? '休息后开始下一周 →' : '继续下一天 →';
    const completedMessage = finalDay
      ? (allDone ? '两册路线已完成。可以回到完整周计划，选择需要继续练习的内容。' : `本日已完成，已到路线末日。已记录 ${model.state.completed.length} / ${model.totalDays} 天，可在完整周计划中继续其他任务。`)
      : (model.state.day === list(week.days).length ? '本周第 6 天已完成。第 7 天休息，准备好后再开始下一周。' : '本日已完成。可以再练一遍，也可以继续下一天。');
    const ids = list(listen.resourceIds).length ? listen.resourceIds : week.resourceIds;
    return `<article class="bp-today-card" aria-labelledby="bp-today-title">
      <header class="bp-today-head"><div class="bp-today-meta"><span>第 ${esc(week.week)} 周 · 第 ${esc(day.day)} 天</span><span>${bookLabel(week.book)} · ${esc(week.kind)}</span><strong>45 分钟</strong></div><p class="bp-today-lessons">${esc(day.lessons)}</p><h2 id="bp-today-title" tabindex="-1">${esc(today.goal || day.outcome || day.title)}</h2><p class="bp-today-intro">${esc(day.title)}</p></header>
      <section class="bp-today-section bp-listen"><div class="bp-today-section-title"><span aria-hidden="true">1</span><h3>今天听什么</h3></div><p class="bp-listen-title">${esc(listen.title || day.lessons)}</p><p>${esc(listen.instruction || '先听一遍，再对照教材听一遍，挑出今天要练的表达。')}</p>${resourcesFor(model, ids).length ? `<details class="bp-listen-resources"><summary>找到教材和原课文音频</summary><p>使用你已有的教材和音频。打开资料路径，定位上面的课号。</p><div class="bp-week-resources">${resourceLinks(model, ids)}</div></details>` : ''}</section>
      <section class="bp-today-section bp-speak"><div class="bp-today-section-title"><span aria-hidden="true">2</span><h3>今天说这三句</h3></div><p class="bp-speak-instruction">先跟读，再换成自己的信息；最后合上文字说一次。</p><ol class="bp-phrases">${phrases.map((phrase, index) => `<li><div><p lang="en" class="bp-phrase-en">${esc(phrase.en)}</p><p class="bp-phrase-zh">${esc(phrase.zh)}</p></div><button type="button" data-plan-speak="${index}" aria-label="听句子：${esc(phrase.en)}" aria-pressed="false">听句子</button></li>`).join('')}</ol><p class="bp-speech-status" role="status" aria-live="polite" data-plan-speech-status></p><details class="bp-speech-note"><summary>句子示范说明</summary><p>“听句子”由浏览器合成语音，用于示范上面三句。原课文请使用教材配套音频。浏览器不支持语音时，可对照英文自行朗读。</p></details></section>
      <section class="bp-today-section bp-today-check"><div class="bp-today-section-title"><span aria-hidden="true">3</span><h3>做到这里就完成</h3></div><p>${esc(today.done || day.done)}</p>${today.review ? `<p class="bp-today-review"><strong>开始前复习</strong>${esc(today.review)}</p>` : ''}</section>
      <div class="bp-today-steps">${taskSteps(day)}</div>
      <footer class="bp-today-actions"><div class="bp-completion-buttons"><button type="button" class="button bp-complete" data-plan-complete${completed ? ' disabled' : ''}>${completed ? '✓ 今天已完成' : '我已达到完成标准'}</button>${completed && !finalDay ? `<button type="button" class="button secondary" data-plan-continue>${nextLabel}</button>` : ''}</div><p class="bp-completion-note" role="status">${completed ? esc(completedMessage) : '完成后再点击按钮。学习进度按你的完成情况推进。'}</p></footer>
      <section class="bp-print-resources"><h3>本日配套资料</h3>${resourcesFor(model, ids).map(resource => `<p><strong>${esc(resource.title)}</strong><br>${esc(fullPath(model.data.sourceRoot, resource.relativePath))}</p>`).join('')}</section>
    </article>`;
  }

  function dayCards(week) {
    return `<div class="bp-days">${list(week.days).map(day => {
      const total = list(day.tasks).reduce((sum, task) => sum + number(task.minutes), 0);
      const dayNumber = /^\d+$/.test(String(day.day)) ? `第 ${day.day} 天` : String(day.day);
      return `<article class="bp-day"><div class="bp-day-top"><strong>${esc(dayNumber)}</strong><span>${esc(total)} 分钟</span></div><p class="bp-day-lessons">${esc(day.lessons)}</p><h4>${esc(day.title)}</h4><dl class="bp-day-results"><div><dt>完成到</dt><dd>${esc(day.done)}</dd></div><div><dt>做完能</dt><dd>${esc(day.outcome)}</dd></div></dl>${taskSteps(day)}<div class="bp-study-day"><button type="button" data-plan-study-week="${esc(week.week)}" data-plan-study-day="${esc(day.day)}">学这一天 →</button></div></article>`;
    }).join('')}</div>`;
  }

  function weekPanel(model, week) {
    if (!week) return '<p class="bp-empty">每周任务尚未载入，请刷新页面。</p>';
    const phase = model.phases.find(item => item.id === week.phaseId);
    const resources = resourcesFor(model, week.resourceIds);
    return `<header class="bp-week-head"><div class="bp-week-meta"><span class="bp-week-number">第 ${esc(week.week)} 周</span><span>${bookLabel(week.book)} · ${esc(week.kind)}</span></div><h3 id="bp-week-title" tabindex="-1">${esc(week.title)}</h3><p class="bp-week-lessons">${esc(week.lessons)}</p>${phase ? `<p class="bp-week-phase">所属阶段：${esc(phase.achievement || phase.label)}</p>` : ''}<p class="bp-print-label">本次打印：仅第 ${esc(week.week)} 周，每天 45 分钟、每周 6 天。</p></header><div class="bp-week-goals"><section><h4>本周学什么</h4>${bulletList(week.learn)}<div class="bp-finish"><strong>学到哪里</strong><p>${esc(week.finish)}</p></div></section><section class="bp-can-do"><h4>学完能做什么</h4>${bulletList(week.canDo)}<div class="bp-finish"><strong>留下这份成果</strong><p>${esc(week.deliverable)}</p></div></section></div><div class="bp-pass"><strong>本周过关标准</strong><p>${esc(week.passCriteria)}</p></div>${resources.length ? `<div class="bp-week-resources"><span>本周资料</span>${resourceLinks(model, week.resourceIds)}</div>` : ''}<div class="bp-day-heading"><h3>第 ${esc(week.week)} 周 · 每天怎么学</h3><span>按第 1 → 6 天完成</span></div>${dayCards(week)}<div class="bp-rest"><span>第 7 天</span><strong>休息，不安排新课</strong><p>本周还没完成的任务留到下次接着做；未达到过关标准时，先补练再进入下一周。</p></div>${resources.length ? `<section class="bp-print-resources"><h3>本周配套资料</h3>${resources.map(resource => `<p><strong>${esc(resource.title)}</strong><br>${esc(fullPath(model.data.sourceRoot, resource.relativePath))}</p>`).join('')}</section>` : ''}`;
  }

  function weekOptions(model, phaseId, selectedWeek) {
    return model.phases.filter(phase => phaseId === 'all' || phase.id === phaseId).map(phase => {
      const weeks = model.weeks.filter(week => week.phaseId === phase.id);
      if (!weeks.length) return '';
      return `<optgroup label="${esc(bookLabel(phase.book))} · ${esc(phase.label)}">${weeks.map(week => `<option value="${esc(week.week)}"${number(selectedWeek) === number(week.week) ? ' selected' : ''}>第 ${esc(week.week)} 周 · ${esc(week.lessons)} · ${esc(week.kind)}</option>`).join('')}</optgroup>`;
    }).join('');
  }

  function phaseCards(model) {
    return model.phases.map((phase, index) => {
      const weeks = model.weeks.filter(week => week.phaseId === phase.id);
      return `<article class="bp-phase"><header class="bp-phase-head"><span class="bp-phase-marker" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><div><p class="bp-phase-meta">${bookLabel(phase.book)} · 第 ${esc(phase.weekStart)}–${esc(phase.weekEnd)} 周 · ${esc(text(phase.lessons))}</p><h3>${esc(phase.achievement || phase.label)}</h3></div></header><div class="bp-phase-body"><dl class="bp-outcomes">${list(phase.outcomes).map(outcome => `<div><dt>${esc(outcome.skill)}</dt><dd>${esc(outcome.text)}</dd></div>`).join('')}</dl><dl class="bp-results"><div><dt>完成作品</dt><dd>${esc(phase.evidence)}</dd></div><div><dt>过关标准</dt><dd>${esc(phase.passCriteria)}</dd></div></dl><details class="bp-phase-weeks"><summary>选择这个阶段的一周<span>${weeks.length} 周</span></summary><ol class="bp-week-links">${weeks.map(week => `<li><button type="button" data-plan-jump-week="${esc(week.week)}"><span>第 ${esc(week.week)} 周 · ${esc(week.kind)}</span><strong>${esc(week.lessons)}</strong><small>${esc(week.title)}</small><span class="bp-week-link-action">查看 6 天任务 →</span></button></li>`).join('')}</ol></details></div></article>`;
    }).join('');
  }

  function pathField(path, id) {
    return `<div class="bp-path"><label class="bp-sr-only" for="${esc(id)}">本地资料路径</label><div><input id="${esc(id)}" type="text" readonly value="${esc(path)}" spellcheck="false"><button type="button" data-plan-copy="${esc(id)}" class="bp-copy">复制路径</button></div></div>`;
  }

  function render(data) {
    if (!data || typeof data !== 'object' || !window.ChuyuTodayProgress) return '<section class="book-plan"><h1>今日学习</h1><p>学习任务尚未载入，请刷新页面。</p></section>';
    const weeks = list(data.weeks);
    const phases = list(data.phases);
    const usedIds = new Set([...phases.flatMap(phase => list(phase.resourceIds)), ...weeks.flatMap(week => list(week.resourceIds)), ...weeks.flatMap(week => list(week.days).flatMap(day => list(day.today?.listen?.resourceIds)))].map(String));
    const resources = list(data.resources).filter(resource => usedIds.has(String(resource.id)));
    const progress = window.ChuyuTodayProgress.create(weeks);
    let state = progress.defaultState();
    let storageAvailable = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try { state = progress.sanitize(JSON.parse(raw)); } catch { state = progress.defaultState(); }
      }
    } catch { storageAvailable = false; }
    const model = { data, phases, weeks, resources, progress, state, storageAvailable, totalDays: weeks.reduce((sum, week) => sum + list(week.days).length, 0) };
    const id = String(++renderId);
    renderedPlans.set(id, model);
    const first = progress.session(state)?.week || weeks[0];
    const pacing = data.pacing || {};
    const resourceCards = resources.map((resource, index) => `<article class="bp-resource" id="bp-resource-${index}" tabindex="-1"><div class="bp-resource-meta"><span>${bookLabel(resource.book)}</span><span>${esc(resource.role)}</span></div><h3>${esc(resource.title)}</h3>${resource.note ? `<p>${esc(resource.note)}</p>` : ''}${pathField(fullPath(data.sourceRoot, resource.relativePath), `bp-path-${index}`)}</article>`).join('');
    return `<div class="book-plan" data-plan-model="${id}" data-plan-view="today"><header class="bp-header"><div><h1 data-plan-heading>今日学习</h1><p>新概念第一册 · 第二册　每天 ${number(pacing.dailyMinutes) || 45} 分钟，每周 ${number(pacing.daysPerWeek) || 6} 天</p></div><button type="button" class="button secondary" data-plan-print>打印今天</button></header><nav class="bp-view-nav" aria-label="学习视图"><button type="button" data-plan-view-button="today" aria-pressed="true">今日学习</button><button type="button" data-plan-view-button="weeks" aria-pressed="false">完整周计划</button></nav>
      <section class="bp-today-view" data-plan-today-view><p class="bp-resume">每次只做当天任务 · <span data-plan-progress-count>已完成 ${state.completed.length} / ${model.totalDays} 天</span></p><div data-plan-today-panel>${todayPanel(model)}</div><details class="bp-adjust"><summary>调整学习进度<span>选择周次和天数</span></summary><p>手动定位到要学习的这一天；保存位置不会标记任务已完成。</p><div class="bp-adjust-controls"><div class="bp-select-field"><label for="bp-adjust-week">学习周次</label><select id="bp-adjust-week" data-plan-adjust-week>${weekOptions(model, 'all', state.week)}</select></div><div class="bp-select-field"><label for="bp-adjust-day">本周第几天</label><select id="bp-adjust-day" data-plan-adjust-day>${list(first?.days).map(day => `<option value="${esc(day.day)}"${number(state.day) === number(day.day) ? ' selected' : ''}>第 ${esc(day.day)} 天 · ${esc(day.title)}</option>`).join('')}</select></div><button type="button" class="button secondary" data-plan-locate>保存学习位置</button></div></details><p class="bp-storage-status" role="status" aria-live="polite" data-plan-storage-status>${storageAvailable ? '进度保存在当前浏览器。周次按学习顺序推进，不按日历跳课。' : '当前浏览器无法保存进度，本次选择仅在页面打开期间有效。'}</p></section>
      <section data-plan-weeks-view hidden><section class="bp-planner" id="bp-planner" aria-labelledby="bp-planner-title"><div class="bp-section-head"><h2 id="bp-planner-title">每周 · 每天任务</h2><span>${weeks.length} 周，随时查询</span></div><div class="bp-week-controls"><div class="bp-select-field"><label for="bp-phase-select">① 选择阶段</label><select id="bp-phase-select" data-plan-phase-select><option value="all">全部阶段 · ${weeks.length} 周</option>${phases.map((phase, index) => `<option value="${esc(phase.id)}">${String(index + 1).padStart(2, '0')} · ${bookLabel(phase.book)} · 第 ${esc(phase.weekStart)}–${esc(phase.weekEnd)} 周 · ${esc(phase.label)}</option>`).join('')}</select></div><div class="bp-select-field"><label for="bp-week-select">② 查看哪一周</label><select id="bp-week-select" data-plan-week-select>${weekOptions(model, 'all', first?.week)}</select></div><div class="bp-week-arrows"><button type="button" data-plan-prev aria-label="查看上一周"${weeks.indexOf(first) <= 0 ? ' disabled' : ''}>← 上一周</button><span data-plan-position>${first ? `第 ${esc(first.week)} / ${weeks.length} 周` : ''}</span><button type="button" data-plan-next aria-label="查看下一周"${weeks.indexOf(first) >= weeks.length - 1 ? ' disabled' : ''}>下一周 →</button></div></div><p class="bp-query-note">这里用于查询完整路线。点击某天的“学这一天”，才会调整今日学习位置。</p><p class="bp-sr-only" aria-live="polite" aria-atomic="true" data-plan-week-status></p><div class="bp-week-panel" data-plan-week-panel aria-labelledby="bp-week-title">${weekPanel(model, first)}</div></section><details class="bp-fold bp-route"><summary><h2>两册全程 · 阶段成果总览</h2><span>${phases.length} 个阶段，可跳到任意周</span></summary><div class="bp-fold-content"><div class="bp-overview"><article><span>第一册 · 144 课 · 42 周</span><h3>从开口问答，到讲生活经历</h3><p>结册练习目标：说约 90 秒的故事或计划，写约 100 词短文。</p></article><article><span>第二册 · 96 课 · 56 周</span><h3>从复述课文，到独立表达</h3><p>结册练习目标：围绕熟悉主题说 2–3 分钟，完成教材摘要与分段写作。</p></article></div><p class="bp-section-hint">另含 2 周发音起步、2 周两册衔接。周次表示学习顺序；未掌握时顺延，先做到再推进。</p><div class="bp-timeline">${phaseCards(model)}</div></div></details></section>
      <details class="bp-fold bp-resources"><summary><h2>配套资料</h2><span>教材、音频、讲解与练习</span></summary><div class="bp-fold-content"><p class="bp-section-hint">这些是现有本地资料。复制路径后，粘贴到 Windows 文件资源管理器中打开；其他设备需使用自己的对应资料。</p><p class="bp-copy-status" role="status" aria-live="polite" data-plan-copy-status></p><div class="bp-resource-grid">${resourceCards}</div></div></details>
    </div>`;
  }

  function bind(root) {
    const page = root?.matches?.('.book-plan') ? root : root?.querySelector?.('.book-plan');
    if (!page || boundPages.has(page)) return;
    const model = renderedPlans.get(page.dataset.planModel);
    if (!model) return;
    renderedPlans.delete(page.dataset.planModel);
    boundPages.add(page);
    const phaseSelect = page.querySelector('[data-plan-phase-select]');
    const weekSelect = page.querySelector('[data-plan-week-select]');
    const panel = page.querySelector('[data-plan-week-panel]');
    const todayRoot = page.querySelector('[data-plan-today-panel]');
    const adjustWeek = page.querySelector('[data-plan-adjust-week]');
    const adjustDay = page.querySelector('[data-plan-adjust-day]');
    let currentWeek = model.progress.session(model.state)?.week || model.weeks[0];
    let printState = null;
    let speechToken = 0;
    let speakingIndex = null;
    const filteredWeeks = () => model.weeks.filter(week => phaseSelect.value === 'all' || week.phaseId === phaseSelect.value);
    const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    function stopSpeech() {
      speechToken += 1;
      speakingIndex = null;
      try { window.speechSynthesis?.cancel(); } catch { /* A browser can expose the API while denying it. */ }
      page.querySelectorAll('[data-plan-speak]').forEach(button => { button.textContent = '听句子'; button.setAttribute('aria-pressed', 'false'); });
    }

    function speechStatus(message) {
      const status = page.querySelector('[data-plan-speech-status]');
      if (status) status.textContent = message;
    }

    function speakPhrase(index) {
      const session = model.progress.session(model.state);
      const phrase = list(session?.day?.today?.phrases)[index];
      if (!phrase?.en) return;
      if (speakingIndex === index) { stopSpeech(); speechStatus('句子示范已停止。'); return; }
      stopSpeech();
      if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') {
        speechStatus('当前浏览器不支持句子示范，请对照英文自行朗读。');
        return;
      }
      const token = speechToken;
      const button = page.querySelector(`[data-plan-speak="${index}"]`);
      try {
        const utterance = new window.SpeechSynthesisUtterance(String(phrase.en));
        utterance.lang = 'en-GB';
        utterance.rate = 0.86;
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(item => /^en[-_]GB$/i.test(item.lang)) || voices.find(item => /^en[-_]/i.test(item.lang));
        if (voice) utterance.voice = voice;
        speakingIndex = index;
        button.textContent = '停止示范';
        button.setAttribute('aria-pressed', 'true');
        const finish = message => {
          if (token !== speechToken) return;
          speakingIndex = null;
          button.textContent = '听句子';
          button.setAttribute('aria-pressed', 'false');
          speechStatus(message);
        };
        utterance.onend = () => finish('示范结束。跟读一遍，再用自己的信息说一遍。');
        utterance.onerror = () => finish('句子示范暂时无法播放，请对照英文自行朗读。');
        speechStatus('正在播放浏览器句子示范。');
        window.speechSynthesis.speak(utterance);
      } catch { stopSpeech(); speechStatus('句子示范暂时无法播放，请对照英文自行朗读。'); }
    }

    function updateAdjustment() {
      adjustWeek.value = String(model.state.week);
      const week = model.progress.session(model.state)?.week;
      adjustDay.innerHTML = list(week?.days).map(day => `<option value="${esc(day.day)}"${number(model.state.day) === number(day.day) ? ' selected' : ''}>第 ${esc(day.day)} 天 · ${esc(day.title)}</option>`).join('');
    }

    function saveState(state, message = '') {
      model.state = model.progress.sanitize(state);
      const status = page.querySelector('[data-plan-storage-status]');
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(model.state));
        model.storageAvailable = true;
        status.textContent = message || '进度已保存在当前浏览器。下次打开从这里继续。';
      } catch {
        model.storageAvailable = false;
        status.textContent = '当前浏览器无法保存进度，本次选择仅在页面打开期间有效。';
      }
      stopSpeech();
      todayRoot.innerHTML = todayPanel(model);
      page.querySelector('[data-plan-progress-count]').textContent = `已完成 ${model.state.completed.length} / ${model.totalDays} 天`;
      updateAdjustment();
    }

    function setView(view, focus = false) {
      if (view !== 'today' && view !== 'weeks') return;
      stopSpeech();
      page.dataset.planView = view;
      page.querySelector('[data-plan-today-view]').hidden = view !== 'today';
      page.querySelector('[data-plan-weeks-view]').hidden = view !== 'weeks';
      page.querySelectorAll('[data-plan-view-button]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.planViewButton === view)));
      page.querySelector('[data-plan-heading]').textContent = view === 'today' ? '今日学习' : '两册学习路线';
      page.querySelector('[data-plan-print]').textContent = view === 'today' ? '打印今天' : '打印当前周';
      if (focus) {
        const title = page.querySelector(view === 'today' ? '#bp-today-title' : '#bp-week-title');
        title?.focus({ preventScroll: true });
        page.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
      }
    }

    function selectWeek(weekNumber, focusPanel = false) {
      const selected = model.weeks.find(week => number(week.week) === number(weekNumber));
      if (!selected) return;
      currentWeek = selected;
      weekSelect.value = String(selected.week);
      panel.innerHTML = weekPanel(model, selected);
      const available = filteredWeeks();
      const index = available.indexOf(selected);
      page.querySelector('[data-plan-prev]').disabled = index <= 0;
      page.querySelector('[data-plan-next]').disabled = index < 0 || index >= available.length - 1;
      page.querySelector('[data-plan-position]').textContent = `第 ${selected.week} / ${model.weeks.length} 周`;
      page.querySelector('[data-plan-week-status]').textContent = `已显示第 ${selected.week} 周：${selected.lessons}，${selected.title}。下方是本周成果与 6 天任务。`;
      if (focusPanel) {
        panel.querySelector('#bp-week-title')?.focus({ preventScroll: true });
        page.querySelector('#bp-planner').scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
      }
    }

    page.addEventListener('change', event => {
      if (event.target === phaseSelect) {
        const available = filteredWeeks();
        const selected = available.includes(currentWeek) ? currentWeek : available[0];
        weekSelect.innerHTML = weekOptions(model, phaseSelect.value, selected?.week);
        selectWeek(selected?.week);
      } else if (event.target === weekSelect) {
        selectWeek(weekSelect.value);
      } else if (event.target === adjustWeek) {
        const week = model.weeks.find(item => number(item.week) === number(adjustWeek.value));
        adjustDay.innerHTML = list(week?.days).map(day => `<option value="${esc(day.day)}">第 ${esc(day.day)} 天 · ${esc(day.title)}</option>`).join('');
      }
    });

    window.addEventListener('beforeprint', () => {
      if (!page.isConnected || printState) return;
      stopSpeech();
      const activePanel = page.dataset.planView === 'today' ? todayRoot : panel;
      printState = Array.from(activePanel.querySelectorAll('details'), item => [item, item.open]);
      printState.forEach(([item]) => { item.open = true; });
    });
    window.addEventListener('afterprint', () => {
      if (!printState) return;
      printState.forEach(([item, open]) => { item.open = open; });
      printState = null;
    });
    window.addEventListener('pagehide', stopSpeech);

    page.addEventListener('click', async event => {
      const button = event.target.closest?.('[data-plan-view-button], [data-plan-speak], [data-plan-complete], [data-plan-continue], [data-plan-locate], [data-plan-study-day], [data-plan-prev], [data-plan-next], [data-plan-jump-week], [data-plan-print], [data-plan-copy], [data-plan-resource]');
      if (!button || !page.contains(button)) return;
      if (button.hasAttribute('data-plan-view-button')) {
        setView(button.dataset.planViewButton);
      } else if (button.hasAttribute('data-plan-speak')) {
        speakPhrase(number(button.dataset.planSpeak));
      } else if (button.hasAttribute('data-plan-complete')) {
        saveState(model.progress.complete(model.state), '今日完成已记录。准备好后，再继续下一天。');
        todayRoot.querySelector('[data-plan-continue]')?.focus({ preventScroll: true });
      } else if (button.hasAttribute('data-plan-continue')) {
        const result = model.progress.next(model.state);
        if (result.moved) {
          saveState(result.state);
          setView('today', true);
        }
      } else if (button.hasAttribute('data-plan-locate') || button.hasAttribute('data-plan-study-day')) {
        const fromDay = button.hasAttribute('data-plan-study-day');
        const weekNumber = fromDay ? number(button.dataset.planStudyWeek) : number(adjustWeek.value);
        const dayNumber = fromDay ? number(button.dataset.planStudyDay) : number(adjustDay.value);
        saveState(model.progress.locate(model.state, weekNumber, dayNumber), '学习位置已保存。已有完成记录保留，本次定位不会标记任务完成。');
        page.querySelector('.bp-adjust').open = false;
        setView('today', true);
      } else if (button.hasAttribute('data-plan-prev') || button.hasAttribute('data-plan-next')) {
        const available = filteredWeeks();
        const index = available.indexOf(currentWeek) + (button.hasAttribute('data-plan-prev') ? -1 : 1);
        selectWeek(available[index]?.week);
      } else if (button.hasAttribute('data-plan-jump-week')) {
        const week = model.weeks.find(item => number(item.week) === number(button.dataset.planJumpWeek));
        if (!week) return;
        setView('weeks');
        phaseSelect.value = week.phaseId;
        weekSelect.innerHTML = weekOptions(model, week.phaseId, week.week);
        selectWeek(week.week, true);
      } else if (button.hasAttribute('data-plan-print')) {
        window.print();
      } else if (button.hasAttribute('data-plan-resource')) {
        event.preventDefault();
        const target = page.querySelector(`#${button.dataset.planResource}`);
        if (target) {
          for (let ancestor = target.parentElement; ancestor && ancestor !== page; ancestor = ancestor.parentElement) {
            if (ancestor.tagName === 'DETAILS') ancestor.open = true;
          }
          target.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
          target.focus({ preventScroll: true });
        }
      } else if (button.hasAttribute('data-plan-copy')) {
        const input = page.querySelector(`#${button.dataset.planCopy}`);
        const status = page.querySelector('[data-plan-copy-status]');
        if (!input) return;
        try {
          if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
          await navigator.clipboard.writeText(input.value);
          button.textContent = '已复制';
          if (status) status.textContent = '路径已复制。';
        } catch {
          input.focus();
          input.select();
          button.textContent = '路径已选中';
          if (status) status.textContent = '请按 Ctrl+C（Mac 使用 ⌘C）复制选中的路径。';
        }
      }
    });
  }

  window.ChuyuBookPlan = Object.freeze({ render, bind });
})();
