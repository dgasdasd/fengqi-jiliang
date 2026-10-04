/*
 * teshu-bridge.js
 *
 * teshu 原版只负责前三页和四图标导引；现有项目的第三页内容、地图拼图、
 * 灾害链和长城小游戏继续由原来的 main.js / p3-games.js 负责。
 */
(function () {
  'use strict';

  var entry = document.getElementById('teshuEntry');
  var frame = document.getElementById('teshuEntryFrame');
  var p3 = document.getElementById('p3');
  if (!entry || !frame || !p3) return;

  var routeButtons = {
    wave: document.getElementById('p3WaveHit'),
    map: document.getElementById('p3MapHit'),
    tree: document.getElementById('p3TreeHit'),
    wall: document.getElementById('p3GreatWallHit')
  };
  function showMenu() {
    entry.classList.remove('is-hidden');
    entry.style.display = 'flex';
    entry.style.visibility = 'visible';
    entry.style.pointerEvents = 'auto';
    entry.setAttribute('aria-hidden', 'false');
    try {
      frame.contentWindow.postMessage({ type: 'teshu-open-menu' }, '*');
    } catch (e) {}
    document.documentElement.classList.remove('p3-route-open');
    window.scrollTo(0, 0);
  }

  function openRoute(route) {
    var button = routeButtons[route];
    if (!button) return;
    document.documentElement.classList.add('p3-route-open');
    entry.classList.add('is-hidden');
    // 直接摘掉入口层，避免 iframe 的合成帧在切换瞬间继续盖住主页面。
    entry.style.display = 'none';
    entry.style.visibility = 'hidden';
    entry.style.pointerEvents = 'none';
    entry.setAttribute('aria-hidden', 'true');
    window.scrollTo(0, p3.offsetTop);
    // teshu 导引页已经沿虚线播放完动画，立即切换到目标内容。
    // 不再点击旧导引页热区，避免重复动画及上一章节短暂闪现。
    var routeEvent = document.createEvent('CustomEvent');
    routeEvent.initCustomEvent('p3-entry-route', false, false, { route: route });
    p3.dispatchEvent(routeEvent);
  }

  window.addEventListener('message', function (event) {
    var data = event && event.data;
    if (!data || data.type !== 'teshu-route') return;
    if (data.route === 'wave' || data.route === 'map' || data.route === 'tree' || data.route === 'wall') {
      openRoute(data.route);
    }
  });

  // 当前内容已有返回按钮。返回时重新打开 teshu 目录，不改变其它章节内容。
  var backIds = [
    'p3StudyBack',
    'p3MapgameBack',
    'p3ImpactBack',
    'p3ImpactReturn',
    'p3AfterBack',
    'p3StatsBack'
  ];
  backIds.forEach(function (id) {
    var button = document.getElementById(id);
    if (!button) return;
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showMenu();
    }, true);
  });
  // 兜底：部分内置浏览器把动态切换后的按钮点击目标 retarget 到父层，
  // 用文档捕获阶段再识别一次，保证返回不会被页面翻页逻辑吞掉。
  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('button') : null;
    if (!target && event.composedPath) {
      var path = event.composedPath();
      target = path.filter(function (node) { return node && node.id && backIds.indexOf(node.id) >= 0; })[0] || null;
    }
    if (!target || backIds.indexOf(target.id) < 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    showMenu();
  }, true);
}());
