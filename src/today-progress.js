/* Pure progress rules shared by the daily page and its checks. */
(function () {
  'use strict';
  function create(weeks) {
    const sessions = [];
    if (Array.isArray(weeks)) weeks.forEach(week => {
      if (!Number.isInteger(week?.week) || !Array.isArray(week.days)) return;
      week.days.forEach(day => {
        if (Number.isInteger(day?.day)) sessions.push({week,day,index:sessions.length});
      });
    });
    const key = (week, day) => `${week}-${day}`;
    const byKey = new Map(sessions.map(item => [key(item.week.week,item.day.day),item]));
    const first = sessions[0];
    const defaultState = () => ({version:1,week:first?.week.week || 1,day:first?.day.day || 1,completed:[]});
    function sanitize(raw) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1) return defaultState();
      const cursorValid = Number.isInteger(raw.week) && Number.isInteger(raw.day) && byKey.has(key(raw.week,raw.day));
      const completed = Array.isArray(raw.completed) ? [...new Set(raw.completed.filter(item => typeof item === 'string' && byKey.has(item)))] : [];
      return {version:1,week:cursorValid?raw.week:first?.week.week || 1,day:cursorValid?raw.day:first?.day.day || 1,completed};
    }
    const session = state => { const safe=sanitize(state); return byKey.get(key(safe.week,safe.day)); };
    const isCompleted = state => { const safe=sanitize(state); return safe.completed.includes(key(safe.week,safe.day)); };
    function complete(state) {
      const safe=sanitize(state);
      if (!session(safe)) return safe;
      return {...safe,completed:[...new Set([...safe.completed,key(safe.week,safe.day)])]};
    }
    function locate(state, week, day) {
      const safe=sanitize(state);
      if (!Number.isInteger(week) || !Number.isInteger(day) || !byKey.has(key(week,day))) return safe;
      return {...safe,week,day};
    }
    function next(state) {
      const safe=sanitize(state), current=session(safe);
      if (!current || !isCompleted(safe)) return {state:safe,moved:false,finished:false,rest:false};
      const following=sessions[current.index+1];
      if (!following) return {state:safe,moved:false,finished:true,rest:false};
      return {state:{...safe,week:following.week.week,day:following.day.day},moved:true,finished:false,rest:following.week.week!==current.week.week};
    }
    return Object.freeze({defaultState,sanitize,key,session,isCompleted,complete,locate,next});
  }
  window.ChuyuTodayProgress = Object.freeze({create});
})();
