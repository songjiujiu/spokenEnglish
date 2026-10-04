(() => {
  'use strict';
  const root = document.querySelector('#app');
  if (!window.ChuyuBookPlan || !window.ChuyuTodayProgress || !window.STUDY_PLAN) {
    root.innerHTML = '<section class="load-error"><h1>今日学习</h1><p>学习资料未能载入，请刷新页面后重试。</p></section>';
    return;
  }
  // Daily learning and the full reference route share the same plan.
  root.innerHTML = window.ChuyuBookPlan.render(window.STUDY_PLAN);
  window.ChuyuBookPlan.bind(root);
})();
