(() => {
  'use strict';

  const DAY = 86400000;
  const MAX_DATE = 8640000000000000;
  const INTERVALS = [1, 3, 7, 14, 30, 60];
  const GRADES = ['again', 'hard', 'good'];
  const LIMITS = { cards: 3000, mistakes: 1000, en: 120, zh: 200, context: 700, q: 700, answer: 700, userAnswer: 700, explain: 1200 };
  const CARD_FIELDS = ['id', 'en', 'zh', 'context', 'unitId', 'wordIndex', 'due', 'level', 'reviews', 'createdAt', 'lastGrade', 'lastReviewed', 'algorithmVersion', 'contentVersion'];
  const MISTAKE_FIELDS = ['id', 'unitId', 'q', 'answer', 'userAnswer', 'explain', 'resolved', 'createdAt', 'updatedAt', 'resolvedAt'];
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(value) && !['__proto__', 'prototype', 'constructor'].includes(value);
  const timestamp = value => Number.isSafeInteger(value) && value >= 0 && value <= MAX_DATE;
  const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;

  function requireNow(now) {
    if (!timestamp(now)) throw Error('复习时间无效。');
    return now;
  }
  function collection(state, name) {
    if (!record(state)) throw Error('学习记录必须是对象。');
    if (state[name] === undefined) return Object.create(null);
    if (!record(state[name])) throw Error(`${name} 必须是对象。`);
    return state[name];
  }
  function requiredText(value, name, limit) {
    if (typeof value !== 'string' || !value.trim() || value.length > limit) throw Error(`${name} 为空或超过 ${limit} 字符。`);
    return value;
  }
  function expression(value) {
    return String(value).toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']+/g, ' ').trim();
  }

  // New cards keep a content snapshot. Re-entering a unit never resets its schedule.
  function ensureCards(state, unit, now, contentVersion = 1) {
    requireNow(now);
    if (!record(unit) || !safeId(unit.id) || unit.id.startsWith('c-') || !Array.isArray(unit.words) || unit.words.length !== 3) throw Error('练习必须包含有效 ID 和三条表达。');
    if (!integer(contentVersion, 1, Number.MAX_SAFE_INTEGER)) throw Error('课程内容版本无效。');
    const cards = collection(state, 'cards');
    const added = [];
    for (let index = 0; index < 3; index++) {
      const id = `${unit.id}-w${index}`;
      if (own(cards, id)) continue;
      const word = unit.words[index];
      const en = requiredText(word?.en, '英文表达', LIMITS.en);
      const zh = requiredText(word?.zh, '中文提示', LIMITS.zh);
      const needle = expression(en);
      const line = (Array.isArray(unit.lines) ? unit.lines : []).find(item => typeof item?.en === 'string' && needle && ` ${expression(item.en)} `.includes(` ${needle} `));
      added.push({ id, en, zh, context: line?.en.slice(0, LIMITS.context) || '', unitId: unit.id, wordIndex: index, due: now, level: 0, reviews: 0, createdAt: now, lastGrade: null, lastReviewed: null, algorithmVersion: 1, contentVersion });
    }
    if (Object.keys(cards).length + added.length > LIMITS.cards) throw Error('复习卡已达到 3000 张上限；本次未添加卡片。请先导出备份并整理卡片。');
    state.cards = cards;
    for (const card of added) cards[card.id] = card;
    return added;
  }

  function dueCards(state, now) {
    requireNow(now);
    return Object.values(collection(state, 'cards')).filter(card => record(card) && timestamp(card.due) && card.due <= now).sort((a, b) => a.due - b.due || String(a.id).localeCompare(String(b.id)));
  }

  function gradeCard(state, id, grade, { revealed = false, now = Date.now() } = {}) {
    requireNow(now);
    if (revealed !== true) throw Error('先翻开卡片核对答案，再选择回忆反馈。');
    if (!GRADES.includes(grade)) throw Error('回忆反馈无效。');
    const cards = collection(state, 'cards');
    if (!safeId(id) || !own(cards, id) || !record(cards[id])) throw Error('复习卡不存在。');
    const card = cards[id];
    if (card.algorithmVersion !== 1) throw Error('不支持此复习算法版本。');
    if (!integer(card.level, 0, 5) || !integer(card.reviews, 0, Number.MAX_SAFE_INTEGER - 1)) throw Error('复习卡排程数据无效。');
    const delay = grade === 'again' ? 600000 : grade === 'hard' ? DAY : INTERVALS[card.level] * DAY;
    const due = now + delay;
    if (!timestamp(due)) throw Error('下次复习日期超出支持范围。');
    card.due = due;
    card.level = grade === 'again' ? 0 : grade === 'hard' ? Math.max(0, card.level - 1) : Math.min(5, card.level + 1);
    card.reviews++;
    card.lastGrade = grade;
    card.lastReviewed = now;
    return card;
  }

  function recordMistake(state, input, now) {
    requireNow(now);
    if (!record(input) || !safeId(input.id) || !safeId(input.unitId) || typeof input.correct !== 'boolean') throw Error('错题标识或作答状态无效。');
    const mistakes = collection(state, 'mistakes');
    const previous = own(mistakes, input.id) ? mistakes[input.id] : null;
    if (input.correct) {
      if (!record(previous)) return null;
      previous.resolved = true;
      previous.updatedAt = now;
      previous.resolvedAt = now;
      return previous;
    }
    if (!previous && Object.keys(mistakes).length >= LIMITS.mistakes) throw Error('错题已达到 1000 条上限；本次未添加错题。请先导出备份并整理错题。');
    const mistake = {
      id: input.id, unitId: input.unitId,
      q: requiredText(input.q, '题目', LIMITS.q),
      answer: requiredText(input.answer, '参考答案', LIMITS.answer),
      userAnswer: typeof input.userAnswer === 'string' ? input.userAnswer.slice(0, LIMITS.userAnswer) : '',
      explain: typeof input.explain === 'string' ? input.explain.slice(0, LIMITS.explain) : '',
      resolved: false, createdAt: timestamp(previous?.createdAt) ? previous.createdAt : now,
      updatedAt: now, resolvedAt: null
    };
    state.mistakes = mistakes;
    mistakes[input.id] = mistake;
    return mistake;
  }

  function sanitizeReviewData(data, course, now = Date.now()) {
    requireNow(now);
    if (!record(data)) throw Error('复习备份必须是对象。');
    if (own(data, 'schemaVersion') && data.schemaVersion !== 1) throw Error(`不支持数据版本 ${String(data.schemaVersion)}。`);
    if (own(data, 'formatId') && data.formatId !== 'chuyu-local-rebuild-v1') throw Error('不支持此备份格式。');
    if (!Array.isArray(course?.units)) throw Error('课程目录无效。');
    const units = new Map(course.units.map(unit => [unit.id, unit]));
    const cards = Object.create(null), mistakes = Object.create(null), issues = [];
    function entries(name) {
      if (data[name] === undefined) return [];
      if (!record(data[name])) { issues.push(`${name} 不是对象，已丢弃此集合。`); return []; }
      return Object.entries(data[name]);
    }
    function stripped(raw, fields, label) {
      const extra = Object.keys(raw).filter(key => !fields.includes(key));
      if (extra.length) issues.push(`${label}：已移除未知字段 ${extra.join('、').slice(0, 180)}。`);
    }
    function text(raw, key, limit, label, required = false) {
      if (typeof raw[key] !== 'string') {
        if (required) return null;
        if (raw[key] !== undefined && raw[key] !== '') issues.push(`${label}.${key} 类型无效，已置为空文本。`);
        return '';
      }
      if (required && !raw[key].trim()) return null;
      if (raw[key].length > limit) issues.push(`${label}.${key} 超过 ${limit} 字符，已截取。`);
      return raw[key].slice(0, limit);
    }
    function time(raw, key, fallback, label, nullable = false) {
      if (nullable && (raw[key] === null || raw[key] === undefined)) return null;
      if (timestamp(raw[key])) return raw[key];
      issues.push(`${label}.${key} 时间无效，已修正。`);
      return fallback;
    }
    const cardEntries = entries('cards');
    // Never silently downgrade a future scheduling algorithm, even beyond the limit.
    for (const [id, raw] of cardEntries) {
      if (record(raw) && own(raw, 'algorithmVersion') && raw.algorithmVersion !== 1) throw Error(`复习卡 ${id} 的算法版本不支持；未导入数据。`);
    }
    let cardCount = 0, excessCards = 0;
    for (const [id, raw] of cardEntries) {
      const label = `复习卡 ${id.slice(0, 120)}`;
      if (!safeId(id) || !record(raw) || raw.id !== id) { issues.push(`${label}：ID 或条目无效，已丢弃。`); continue; }
      const custom = /^c-[a-zA-Z0-9_-]+$/.test(id);
      let unitId = null, wordIndex = null;
      if (custom) {
        if (raw.unitId !== null && raw.unitId !== undefined) { issues.push(`${label}：自建卡不能引用课程，已丢弃。`); continue; }
        if (raw.unitId !== null || raw.wordIndex !== null) issues.push(`${label}：自建卡课程引用已置空。`);
      } else {
        if (!units.has(raw.unitId) || !integer(raw.wordIndex, 0, 2) || id !== `${raw.unitId}-w${raw.wordIndex}` || !units.get(raw.unitId).words?.[raw.wordIndex]) { issues.push(`${label}：课程或表达引用无效，已丢弃。`); continue; }
        unitId = raw.unitId; wordIndex = raw.wordIndex;
      }
      const en = text(raw, 'en', LIMITS.en, label, true), zh = text(raw, 'zh', LIMITS.zh, label, true);
      if (en === null || zh === null) { issues.push(`${label}：英文或中文提示为空，已丢弃。`); continue; }
      if (cardCount >= LIMITS.cards) { excessCards++; continue; }
      stripped(raw, CARD_FIELDS, label);
      let level = raw.level, reviews = raw.reviews, contentVersion = raw.contentVersion, lastGrade = raw.lastGrade;
      if (!integer(level, 0, 5)) { level = Number.isFinite(level) ? Math.max(0, Math.min(5, Math.trunc(level))) : 0; issues.push(`${label}.level 无效，已修正为 ${level}。`); }
      if (!integer(reviews, 0, Number.MAX_SAFE_INTEGER - 1)) { reviews = 0; issues.push(`${label}.reviews 无效，已归零。`); }
      if (!integer(contentVersion, 1, Number.MAX_SAFE_INTEGER)) { contentVersion = 1; issues.push(`${label}.contentVersion 无效或缺失，已采用版本 1。`); }
      if (raw.algorithmVersion === undefined) issues.push(`${label}.algorithmVersion 缺失，已采用版本 1。`);
      if (lastGrade !== null && !GRADES.includes(lastGrade)) { lastGrade = null; issues.push(`${label}.lastGrade 无效，已置空。`); }
      cards[id] = { id, en, zh, context: text(raw, 'context', LIMITS.context, label), unitId, wordIndex, due: time(raw, 'due', now, label), level, reviews, createdAt: time(raw, 'createdAt', now, label), lastGrade, lastReviewed: time(raw, 'lastReviewed', null, label, true), algorithmVersion: 1, contentVersion };
      cardCount++;
    }
    if (excessCards) issues.push(`复习卡超过 3000 张上限，已丢弃后续 ${excessCards} 张有效卡片。`);
    let mistakeCount = 0, excessMistakes = 0;
    for (const [id, raw] of entries('mistakes')) {
      const label = `错题 ${id.slice(0, 120)}`;
      if (!safeId(id) || !record(raw) || raw.id !== id || !units.has(raw.unitId)) { issues.push(`${label}：ID 或课程引用无效，已丢弃。`); continue; }
      const q = text(raw, 'q', LIMITS.q, label, true), answer = text(raw, 'answer', LIMITS.answer, label, true);
      if (q === null || answer === null) { issues.push(`${label}：题目或参考答案为空，已丢弃。`); continue; }
      if (mistakeCount >= LIMITS.mistakes) { excessMistakes++; continue; }
      stripped(raw, MISTAKE_FIELDS, label);
      if (typeof raw.resolved !== 'boolean') issues.push(`${label}.resolved 无效，已恢复为待复习。`);
      const createdAt = time(raw, 'createdAt', now, label), updatedAt = time(raw, 'updatedAt', createdAt, label);
      const resolved = raw.resolved === true;
      let resolvedAt = resolved ? time(raw, 'resolvedAt', updatedAt, label) : null;
      if (!resolved && raw.resolvedAt !== null && raw.resolvedAt !== undefined) issues.push(`${label}.resolvedAt 与待复习状态不符，已置空。`);
      mistakes[id] = { id, unitId: raw.unitId, q, answer, userAnswer: text(raw, 'userAnswer', LIMITS.userAnswer, label), explain: text(raw, 'explain', LIMITS.explain, label), resolved, createdAt, updatedAt, resolvedAt };
      mistakeCount++;
    }
    if (excessMistakes) issues.push(`错题超过 1000 条上限，已丢弃后续 ${excessMistakes} 条有效错题。`);
    return { cards, mistakes, issues };
  }

  globalThis.ChuyuReview = Object.freeze({ ensureCards, dueCards, gradeCard, recordMistake, sanitizeReviewData });
})();
