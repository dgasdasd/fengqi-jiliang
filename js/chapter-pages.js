(function () {
  'use strict';
  var root = document.getElementById('p3');
  var scroller = document.getElementById('p3Scroll');
  if (!root || !scroller) return;
  var $ = function (selector, scope) { return (scope || root).querySelector(selector); };
  var $$ = function (selector, scope) { return Array.prototype.slice.call((scope || root).querySelectorAll(selector)); };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gates = [], current = null, scrollTimer = 0, wheelLock = 0, refreshing = false;
  root.classList.add('is-paged');

  function heading(value) {
    var el = document.createElement('h2');
    el.className = 'chapter-heading';
    el.textContent = value;
    return el;
  }
  function children(el) { return el ? Array.prototype.slice.call(el.children) : []; }
  function page(parent, title, nodes, extra) {
    var section = document.createElement('section');
    section.className = 'chapter-page ' + (extra || '');
    section.dataset.pageTitle = title;
    section.setAttribute('aria-label', title);
    var content = document.createElement('div');
    content.className = 'chapter-content';
    (nodes || []).filter(Boolean).forEach(function (node) { content.appendChild(node); });
    section.appendChild(content);
    parent.appendChild(section);
    return section;
  }
  function adopt(el, title, extra) {
    if (!el) return null;
    el.classList.add('chapter-page');
    if (extra) el.classList.add(extra);
    el.dataset.pageTitle = title;
    return el;
  }
  function gate(section, test) { gates.push({ page: section, test: test }); }

  // 海浪：温度、动画、形成条件共用一页；达到 26.5°C 后在原位展开。
  var study = $('#p3OriginStudy'), reveal = $('#p3OriginReveal');
  if (study && reveal) {
    reveal.insertBefore(heading('台风形成的条件'), $('#p3OriginCopy'));
    page(study, '海面温度与台风形成', [$('.p3-study-head', study), $('#p3ThermoStage'), reveal], 'chapter-formation');
    var routePage = page(study, '台风的类型', [$('#p3OriginRoute')], 'chapter-routes');
    gate(routePage, function () { return !reveal.hidden; });
  }
  var process = $('.p3-view[data-view="process"]');
  var evidence = $('.p3-view[data-view="evidence"]');
  if (process) page(process, '台风形成的过程', children(process), 'chapter-process');
  if (evidence) page(evidence, '台风形成的四个阶段', children(evidence), 'chapter-evidence');
  var routeView = $('.p3-view[data-view="route"]');
  if (routeView) page(routeView, '台风的类型', children(routeView), 'chapter-route-extra');
  var stats = $('.p3-view[data-view="stats"]');
  if (stats) {
    page(stats, '台风统计', [$('.p3-panel-heading', stats), $('.stats-chart-stack', stats),
      $('.stat-summary', stats), $('#p3StatsBack')], 'chapter-chart chapter-chart-overview');
  }

  // 地图：拼图独占一屏；年份与台风名称沿原本的完整曲线展示。
  var map = $('.p3-mapgame'), history = $('#p3HistoryBlock'), scene = $('#p3HistoryScene');
  if (map && history && scene) {
    var puzzlePage = page(map, '中国地图拼图', [$('.p3-mapgame > .p3-subtitle'), $('.p3-puzzle-panel', map)], 'chapter-puzzle');
    map.insertBefore(puzzlePage, history);
    var timeline = $('.p3-timeline', scene);
    var oldTitle = $('.p3-subtitle', scene), oldHint = $('.p3-history-hint', scene);
    oldHint.textContent = '点击年份，查看台风路径与影响';
    page(scene, '近十年最具代表台风', [oldTitle, oldHint, timeline], 'chapter-years chapter-years-original');
    var report = $('.p3-loss-report', map), charts = $$('.p3-loss-chart', report);
    var analysis = $('.p3-loss-analysis', report), lines = children(analysis);
    page(report, '台风损害影响', [$('#p3LossReportTitle'), $('.p3-loss-intro', report), charts[0], lines[0],
      heading('复合灾害的影响'), lines[1], charts[1]], 'chapter-loss chapter-loss-combined');
    analysis.remove();
  }

  // 树木：人物对话与完整灾害链在同一阅读页，图表仍独立呈现。
  var impact = $('.p3-impact'), impactScene = $('#p3ImpactScene'), chain = $('#p3ImpactChain');
  if (impact && impactScene && chain) {
    page(impact, '风带来了什么', [impactScene, chain], 'chapter-impact-journey');
    var impactStats = $('.p3-impact-statistics', chain), impactCharts = $$('.p3-impact-chart', impactStats);
    var impactCopies = $$('.p3-impact-stat-copy', impactStats);
    impact.appendChild(impactStats);
    page(impactStats, '台风灾害链平均伤害', [$('.p3-impact-statistics h3'), $('.p3-impact-stat-intro'), impactCharts[0], impactCopies[0]], 'chapter-impact-chart');
    page(impactStats, '灾害损失构成', [heading('灾害损失构成'), impactCharts[1], impactCopies[1], $('#p3ImpactReturn')], 'chapter-impact-chart');
    var chartGrid = $('.p3-impact-chart-grid', impactStats);
    if (chartGrid) chartGrid.remove();
  }

  // 长城：小游戏仍使用原来的脚本，人物卡片保持点击翻面。
  var after = $('.p3-after');
  if (after) {
    adopt($('.p3-after-hero', after), '风停之后', 'chapter-wall-hero');
    var games = $('#p3AfterGames'), stage = $('#p3GameStage');
    var gamePage = page(after, '互助小游戏', [stage], 'chapter-game');
    after.insertBefore(gamePage, games.nextSibling);
    gate(gamePage, function () { return !stage.hidden; });
    page(games, '基层的力量，和你一起', children(games), 'chapter-game-menu');
    var story = $('#p3AfterCards'), storyGrid = $('.p3-story-grid', story);
    var storyCards = $$('.p3-story-card', storyGrid);
    storyGrid.classList.add('chapter-story-carousel');
    storyGrid.setAttribute('aria-label', '逆行者故事，左右滑动切换，点击卡片翻面');
    var carousel = document.createElement('div');
    carousel.className = 'chapter-carousel-controls';
    carousel.innerHTML = '<button type="button" aria-label="上一个人物">‹</button><span>1 / ' + storyCards.length + '</span><button type="button" aria-label="下一个人物">›</button>';
    storyGrid.after(carousel);
    var storyIndex = 0;
    function storyGo(index) {
      storyIndex = (index + storyCards.length) % storyCards.length;
      storyGrid.scrollTo({ left: storyIndex * storyGrid.clientWidth, behavior: reduced ? 'auto' : 'smooth' });
      carousel.querySelector('span').textContent = (storyIndex + 1) + ' / ' + storyCards.length;
    }
    carousel.querySelectorAll('button')[0].addEventListener('click', function () { storyGo(storyIndex - 1); });
    carousel.querySelectorAll('button')[1].addEventListener('click', function () { storyGo(storyIndex + 1); });
    storyGrid.addEventListener('scroll', function () {
      storyIndex = Math.round(storyGrid.scrollLeft / Math.max(1, storyGrid.clientWidth));
      carousel.querySelector('span').textContent = (storyIndex + 1) + ' / ' + storyCards.length;
    }, { passive: true });
    page(story, '风雨中的他们', children(story), 'chapter-stories');
    var prep = $('#p3Prep'), panels = $('.p3-prep-panels', prep), invite = $('.p3-archive-invite', prep);
    page(prep, '沿海与内陆的风险', children(prep).filter(function (el) { return el !== panels && el !== invite; }), 'chapter-prep-region');
    page(prep, '防灾准备档案', [heading('防灾准备档案'), panels, invite], 'chapter-prep-cards');
  }

  // 档案袋打开后进入独立章节，避免继续从英雄与区域卡片向下滑到个人档案。
  var archive = $('.p3-archive');
  if (archive) {
    var profile = $('#p3Profile'), reminder = $('.p3-reminder', profile), seal = $('#p3ArchiveSeal');
    page(profile, '我的防风准备卡', children(profile).filter(function (el) { return el !== reminder && el !== seal; }), 'chapter-profile');
    page(profile, '封存我的准备', [heading('让准备早台风一步'), reminder, seal], 'chapter-profile-reminder');
    adopt($('#p3Finale'), '风起山河，不负脊梁', 'chapter-finale');
  }

  var toolbar = document.createElement('div');
  toolbar.className = 'chapter-toolbar';
  toolbar.innerHTML = '<button id="p3ChapterReturn" type="button">‹ 返回导引</button><span id="p3ChapterName"></span>';
  root.appendChild(toolbar);

  function activeView() { return $('.p3-view:not([hidden])'); }
  function visiblePages() {
    var view = activeView();
    if (!view) return [];
    return $$('.chapter-page', view).filter(function (p) { return !p.closest('[hidden]') && p.getClientRects().length > 0; });
  }
  function topOf(p) { return p.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop; }
  function update() {
    var pages = visiblePages();
    if (!pages.length) { current = null; root.classList.remove('is-reading-page'); toolbar.querySelector('span').textContent = ''; return; }
    current = pages.reduce(function (a, b) {
      return Math.abs(topOf(a) - scroller.scrollTop) <= Math.abs(topOf(b) - scroller.scrollTop) ? a : b;
    });
    root.classList.toggle('is-reading-page', current.classList.contains('chapter-chart-overview') ||
      current.classList.contains('chapter-loss-combined') || current.classList.contains('chapter-impact-journey') ||
      current.classList.contains('chapter-stories') || current.classList.contains('chapter-prep-cards'));
    toolbar.querySelector('span').textContent = current.dataset.pageTitle || '';
  }
  function refresh() {
    if (refreshing) return;
    refreshing = true;
    gates.forEach(function (entry) {
      var hide = !entry.test();
      if (entry.page.hidden !== hide) entry.page.hidden = hide;
    });
    refreshing = false;
    update();
  }
  function goTo(target, instant) {
    refresh();
    var p = target && (target.classList.contains('chapter-page') ? target : target.closest('.chapter-page') || $('.chapter-page', target));
    if (!p || p.closest('[hidden]')) return;
    scroller.scrollTo({ top: topOf(p), behavior: instant || reduced ? 'auto' : 'smooth' });
    current = p;
    update();
  }
  function nextView() {
    var view = activeView();
    var name = view && view.dataset.view;
    if (name === 'origin' && reveal && reveal.hidden) return null;
    return { origin: 'process', process: 'evidence', evidence: 'stats' }[name];
  }
  function previousView() {
    var view = activeView();
    return { process: 'origin', evidence: 'process', stats: 'evidence' }[view && view.dataset.view];
  }
  function turn(direction) {
    refresh();
    var pages = visiblePages(), index = pages.indexOf(current);
    if (index < 0) return;
    if (direction > 0 && index === pages.length - 1 && nextView()) {
      var next = $('[data-next="' + nextView() + '"]', activeView());
      if (next) next.click();
      else $('.p3-rail [data-p3-view="' + nextView() + '"]').click();
      requestAnimationFrame(function () { goTo(visiblePages()[0], true); });
      return;
    }
    if (direction < 0 && index === 0 && previousView()) {
      var previous = previousView();
      var back = previous === 'origin' ? $('#p3ProcessBack') : previous === 'process' ? $('#p3EvidenceBack') : $('.p3-rail [data-p3-view="evidence"]');
      if (back) back.click();
      requestAnimationFrame(function () {
        var priorPages = visiblePages();
        goTo(priorPages[priorPages.length - 1], true);
      });
      return;
    }
    goTo(pages[Math.max(0, Math.min(pages.length - 1, index + direction))]);
  }
  toolbar.querySelector('button').addEventListener('click', function () { root.dispatchEvent(new CustomEvent('p3-return-menu')); });
  scroller.addEventListener('scroll', function () { clearTimeout(scrollTimer); scrollTimer = setTimeout(update, 70); }, { passive: true });
  scroller.addEventListener('wheel', function (event) {
    var readingContent = event.target.closest('.chapter-chart-overview .chapter-content, .chapter-loss-combined .chapter-content, .chapter-impact-journey .chapter-content, .chapter-stories .chapter-content, .chapter-prep-cards .chapter-content');
    if (readingContent && ((event.deltaY > 0 && readingContent.scrollTop < readingContent.scrollHeight - readingContent.clientHeight - 1) ||
      (event.deltaY < 0 && readingContent.scrollTop > 1))) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.target.closest('.chapter-formation .chapter-content, .p3-process-scrollbox, .p3-evidence-scrollbox, .p3-game-canvas, .p3-puzzle-board, .p3-thermo, .p3-typhoon-detail, .p3-prep-images')) return;
    event.preventDefault();
    if (Math.abs(event.deltaY) < 8 || Date.now() < wheelLock) return;
    wheelLock = Date.now() + 560;
    turn(event.deltaY > 0 ? 1 : -1);
  }, { passive: false });
  root.addEventListener('keydown', function (event) {
    if (event.target.closest('button, input, [role="slider"], .p3-puzzle-board, .p3-game-canvas, .p3-typhoon-detail')) return;
    if (event.key === 'PageDown' || event.key === 'PageUp') { event.preventDefault(); turn(event.key === 'PageDown' ? 1 : -1); }
  });
  var observer = new MutationObserver(function () { requestAnimationFrame(refresh); });
  observer.observe(scroller, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  window.addEventListener('resize', function () { if (current) goTo(current, true); });
  root.addEventListener('p3-entry-route', function () {
    requestAnimationFrame(function () { goTo(visiblePages()[0], true); });
  });
  if (reveal) new MutationObserver(function () {
    if (!reveal.hidden) requestAnimationFrame(function () {
      var content = $('.chapter-formation .chapter-content');
      if (content) content.scrollTop = 0;
      refresh();
    });
  }).observe(reveal, { attributes: true, attributeFilter: ['hidden'] });
  var chainTrigger = $('#p3ImpactChainTrigger');
  if (chainTrigger) chainTrigger.addEventListener('click', function () {
    requestAnimationFrame(function () {
      var content = $('.chapter-impact-journey .chapter-content');
      if (content && !chain.hidden) content.scrollTo({
        top: chain.getBoundingClientRect().top - content.getBoundingClientRect().top + content.scrollTop - 64,
        behavior: reduced ? 'auto' : 'smooth'
      });
    });
  });
  window.P3Pages = { goTo: goTo, refresh: refresh };
  refresh();

})();
