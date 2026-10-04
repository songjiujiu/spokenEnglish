/* A local reference plan. Browsing this page never changes learning progress. */
(function () {
  'use strict';

  const boundPages = new WeakSet();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const list = value => Array.isArray(value) ? value : [];
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const text = value => Array.isArray(value) ? value.join('、') : String(value ?? '');

  function bookKey(value) {
    const raw = String(value ?? '').toLowerCase();
    if (raw === '1' || raw === 'book1' || raw === 'book-1' || /第一册|第1册|一册/.test(raw)) return '1';
    if (raw === '2' || raw === 'book2' || raw === 'book-2' || /第二册|第2册|二册/.test(raw)) return '2';
    return 'both';
  }

  function bookLabel(value) {
    const key = bookKey(value);
    return key === '1' ? '第一册' : key === '2' ? '第二册' : '两册通用';
  }

  function fullPath(sourceRoot, relativePath) {
    const path = String(relativePath ?? '');
    if (/^[a-z]:[\\/]|^\\\\|^\//i.test(path)) return path;
    return `${String(sourceRoot ?? '').replace(/[\\/]+$/, '')}\\${path.replace(/^[\\/]+/, '').replace(/\//g, '\\')}`;
  }

  function taskList(tasks) {
    return `<ol class="bp-task-list">${list(tasks).map(task => `<li><span class="bp-task-minutes">${esc(task.minutes)}<small>分钟</small></span><span>${esc(task.text)}</span></li>`).join('')}</ol>`;
  }

  function dayCards(days) {
    return `<div class="bp-days">${list(days).map((day, index) => {
      const total = list(day.tasks).reduce((sum, task) => sum + number(task.minutes), 0);
      const label = day.day === undefined ? `第 ${index + 1} 天` : /^\d+$/.test(String(day.day)) ? `第 ${day.day} 天` : day.day;
      return `<article class="bp-day"><div class="bp-day-top"><span>${esc(label)}</span><span>${esc(total)} 分钟</span></div><h3>${esc(day.title)}</h3>${taskList(day.tasks)}</article>`;
    }).join('')}</div>`;
  }

  function pathField(path, id, label) {
    return `<div class="bp-path"><label for="${esc(id)}">${esc(label)}</label><div><input id="${esc(id)}" type="text" readonly value="${esc(path)}" spellcheck="false"><button type="button" data-plan-copy="${esc(id)}" class="bp-copy">复制路径</button></div><span class="bp-path-print">${esc(path)}</span></div>`;
  }

  function render(data) {
    if (!data || typeof data !== 'object') return '<section class="book-plan"><h1>两册学习规划</h1><p>学习规划数据尚未载入。</p><a href="#roadmap">返回成长路线</a></section>';
    const pacing = data.pacing || {};
    const summary = data.summary || {};
    const phases = list(data.phases);
    const resources = list(data.resources);
    const templates = list(data.weekTemplates);
    const firstDays = list(data.firstWeek);
    const dailyTasks = list(firstDays[0]?.tasks);
    const dailyTotal = dailyTasks.reduce((sum, task) => sum + number(task.minutes), 0);
    const dailyMinutes = number(pacing.dailyMinutes) || 45;
    const daysPerWeek = number(pacing.daysPerWeek) || 6;
    const resourceIndex = new Map(resources.map((resource, index) => [String(resource.id), index]));
    const phaseCards = phases.map((phase, index) => {
      const resourceLinks = list(phase.resourceIds).filter(id => resourceIndex.has(String(id))).map(id => {
        const resourceNumber = resourceIndex.get(String(id));
        return `<a href="#bp-resource-${resourceNumber}" data-plan-resource="bp-resource-${resourceNumber}">${esc(resources[resourceNumber].title)}</a>`;
      }).join('');
      const schedule = list(phase.schedule);
      const scheduleItems = schedule.map(week => `<li><div><strong>第 ${esc(week.week)} 周</strong><span>${esc(week.kind)}</span></div><p>${esc(week.lessons)}</p><small>${esc(week.goal)}</small></li>`).join('');
      const weeklySchedule = schedule.length ? `<details class="bp-schedule"><summary>查看本阶段 ${schedule.length} 周的课号安排</summary><ol>${scheduleItems}</ol></details><section class="bp-schedule-paper"><h4>逐周课号安排</h4><ol>${scheduleItems}</ol></section>` : '';
      return `<article class="bp-phase" data-plan-book="${bookKey(phase.book)}"><div class="bp-phase-marker" aria-hidden="true">${String(index + 1).padStart(2, '0')}</div><div class="bp-phase-content"><div class="bp-phase-meta"><span>${bookLabel(phase.book)} · ${esc(text(phase.lessons))}</span><span>第 ${esc(phase.weekStart)}–${esc(phase.weekEnd)} 周 · ${esc(phase.weeks)} 周</span></div><h3>${esc(phase.label)}</h3><p>${esc(text(phase.focus))}</p><dl><div><dt>每阶段产出</dt><dd>${esc(text(phase.output))}</dd></div><div><dt>进入下一阶段前</dt><dd>${esc(text(phase.checkpoint))}</dd></div></dl>${weeklySchedule}${resourceLinks ? `<div class="bp-phase-resources"><span>配套资料</span>${resourceLinks}</div>` : ''}</div></article>`;
    }).join('');
    const templateTabs = templates.map((template, index) => `<button type="button" data-plan-template="${index}" aria-pressed="${index === 0}" aria-controls="bp-template-${index}">${esc(template.title)}</button>`).join('');
    const templatePanels = templates.map((template, index) => `<section id="bp-template-${index}" class="bp-template-panel" data-plan-template-panel="${index}"${index ? ' hidden' : ''} aria-labelledby="bp-template-title-${index}"><h3 id="bp-template-title-${index}" class="bp-template-title">${esc(template.title)}</h3>${dayCards(template.days)}</section>`).join('');
    const resourceCards = resources.map((resource, index) => `<article class="bp-resource" id="bp-resource-${index}" tabindex="-1"><div class="bp-resource-meta"><span>${bookLabel(resource.book)}</span><span>${esc(resource.role)}</span></div><h3>${esc(resource.title)}</h3>${resource.note ? `<p>${esc(resource.note)}</p>` : ''}${pathField(fullPath(data.sourceRoot, resource.relativePath), `bp-path-${index}`, '本地资料路径')}</article>`).join('');
    return `<div class="book-plan">
      <div class="bp-toolbar"><a href="#roadmap">← 返回成长路线</a><button type="button" class="button secondary" data-plan-print>打印学习规划</button></div>
      <header class="bp-hero"><div><span class="bp-eyebrow">NEW CONCEPT ENGLISH · STUDY PLAN</span><h1>两册打好基础，<br>把英语练到能开口。</h1><p>从本地资料出发，把课程、练习和复习放进每天可执行的时间里。</p><div class="bp-hero-tags"><span>每天 ${esc(dailyMinutes)} 分钟</span><span>每周 ${esc(daysPerWeek)} 天</span><span>每周 ${esc(dailyMinutes * daysPerWeek)} 分钟</span></div></div><div class="bp-duration"><span>两册学习周期参考</span><strong>${esc(pacing.totalWeeks)}<small>周</small></strong><p>包含学习与巩固节奏<br>按阶段检查结果调整进度</p></div></header>
      <div class="bp-overview"><article><span class="bp-eyebrow">BOOK ONE</span><h2>第一册 · 建立基础</h2><p>从声音、词句到日常表达，建立每天开口与复习的习惯。</p><span class="bp-source-count">144 课 · 72 对课 · 42 周参考安排</span></article><article><span class="bp-eyebrow">BOOK TWO</span><h2>第二册 · 连成表达</h2><p>把句子连成短文，练习理解、复述与自主写作。</p><span class="bp-source-count">96 课 · 56 周参考安排</span></article></div>
      <p class="bp-pacing-note">${esc(pacing.description)} 学习周期用于安排时间，不代表已达到某个考试分数或语言等级。</p>
      <div class="bp-layout"><div class="bp-main-column"><section class="bp-section" aria-labelledby="bp-route-title"><div class="bp-section-head"><div><span class="bp-eyebrow">01 / THE ROUTE</span><h2 id="bp-route-title">沿着主线，一阶段一阶段来</h2></div></div><div class="bp-tabs bp-book-filter" role="group" aria-label="按册查看学习阶段"><button type="button" data-plan-filter="all" aria-pressed="true">完整路线</button><button type="button" data-plan-filter="1" aria-pressed="false">第一册</button><button type="button" data-plan-filter="2" aria-pressed="false">第二册</button></div><div class="bp-timeline">${phaseCards}</div><p class="bp-small-note">周次按完整路线累计。筛选只改变显示，不会修改计划或学习记录。</p></section></div><aside class="bp-side-column"><section class="bp-daily" aria-labelledby="bp-daily-title"><span class="bp-eyebrow">YOUR ${esc(dailyMinutes)} MINUTES</span><h2 id="bp-daily-title">每天都留时间输出</h2><p>以首日任务为例。新课、练习与复盘日的具体配比见下方安排。</p>${dailyTasks.length ? `<div class="bp-time-bar" aria-hidden="true">${dailyTasks.map((task, index) => `<span class="bp-time-${index % 6}" style="flex:${Math.max(0, number(task.minutes)) / (dailyTotal || 1)}"></span>`).join('')}</div>${taskList(dailyTasks)}` : `<p>每天 ${esc(dailyMinutes)} 分钟，每周 ${esc(daysPerWeek)} 天。</p>`}</section><section class="bp-rules" aria-labelledby="bp-rules-title"><span class="bp-eyebrow">KEEP IT SUSTAINABLE</span><h2 id="bp-rules-title">按掌握程度往前走</h2><ul>${list(data.rules).map(rule => `<li>${esc(rule)}</li>`).join('')}</ul></section></aside></div>
      <section class="bp-section bp-first-week" aria-labelledby="bp-first-title"><div class="bp-section-head"><div><span class="bp-eyebrow">02 / START THIS WEEK</span><h2 id="bp-first-title">第一周，照着做就能开始</h2></div><span>${esc(daysPerWeek)} 个学习日 · 每天 ${esc(dailyMinutes)} 分钟</span></div>${dayCards(firstDays)}<div class="bp-rest-note"><strong>留一天休息和缓冲</strong><span>本周未完成的内容可在下一学习日接着做；不通过挤压休息来追赶课数。</span></div></section>
      <section class="bp-section" aria-labelledby="bp-week-title"><div class="bp-section-head"><div><span class="bp-eyebrow">03 / A WEEKLY RHYTHM</span><h2 id="bp-week-title">每周怎么安排</h2></div></div><div class="bp-tabs" role="group" aria-label="选择周计划模板">${templateTabs}</div>${templatePanels}</section>
      <section class="bp-section" aria-labelledby="bp-resource-title"><div class="bp-section-head"><div><span class="bp-eyebrow">04 / YOUR LOCAL LIBRARY</span><h2 id="bp-resource-title">资料有分工，不必全部同时学</h2></div><span>扫描文件 ${esc(summary.totalFiles ?? '—')} 份</span></div><div class="bp-source-folder"><p>原目录中的资料保留在本机。复制路径后，可粘贴到 Windows 文件资源管理器中打开。</p>${pathField(data.sourceRoot || '', 'bp-source-root', '本地文件夹路径')}<p class="bp-copy-status" role="status" aria-live="polite" data-plan-copy-status></p></div><div class="bp-resource-grid">${resourceCards}</div>${summary.videoNote ? `<p class="bp-small-note">${esc(summary.videoNote)}</p>` : ''}</section>
      <footer class="bp-notes"><h2>使用说明</h2><ul>${list(data.notes).map(note => `<li>${esc(note)}</li>`).join('')}</ul><p>资料扫描：${esc(data.scannedAt || '未记录')} · 规划版本：${esc(data.version ?? 1)}</p></footer>
    </div>`;
  }

  function bind(root) {
    const page = root?.matches?.('.book-plan') ? root : root?.querySelector?.('.book-plan');
    if (!page || boundPages.has(page)) return;
    boundPages.add(page);
    page.addEventListener('click', async event => {
      const button = event.target.closest?.('[data-plan-filter], [data-plan-template], [data-plan-print], [data-plan-copy], [data-plan-resource]');
      if (!button || !page.contains(button)) return;
      if (button.hasAttribute('data-plan-filter')) {
        const selected = button.dataset.planFilter;
        page.querySelectorAll('[data-plan-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
        page.querySelectorAll('[data-plan-book]').forEach(item => { item.hidden = selected !== 'all' && item.dataset.planBook !== selected && item.dataset.planBook !== 'both'; });
      } else if (button.hasAttribute('data-plan-template')) {
        const selected = button.dataset.planTemplate;
        page.querySelectorAll('[data-plan-template]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
        page.querySelectorAll('[data-plan-template-panel]').forEach(item => { item.hidden = item.dataset.planTemplatePanel !== selected; });
      } else if (button.hasAttribute('data-plan-print')) {
        window.print();
      } else if (button.hasAttribute('data-plan-resource')) {
        event.preventDefault();
        const target = page.querySelector(`#${button.dataset.planResource}`);
        if (target) {
          target.scrollIntoView({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
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
          if (status) status.textContent = '路径已复制，可粘贴到文件资源管理器中打开。';
        } catch {
          input.focus();
          input.select();
          button.textContent = '路径已选中';
          if (status) status.textContent = '浏览器未能自动复制。路径已选中，请按 Ctrl+C（Mac 使用 ⌘C）复制。';
        }
      }
    });
  }

  window.ChuyuBookPlan = Object.freeze({ render, bind });
})();
