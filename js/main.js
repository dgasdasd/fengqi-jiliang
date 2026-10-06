/* ============================================================
   main.js —— 风栖过的脊梁
   ① 首屏：山升起 → 水墨台风沿山川自左向右掠过 → 人影与题目浮现
   ② 第二页：文案被吸进风眼，滚到底出现 CTA
   ③ 进度条 / 章节点 / 平滑跳转
   无依赖，纯原生；动效一律只动 transform / opacity。
   几何数据全部来自对素材图的实测，不是估值。
   ============================================================ */
(function () {
'use strict';

var $  = function (s) { return document.querySelector(s); };
var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
var lerp  = function (a, b, t) { return a + (b - a) * t; };
var easeInCubic = function (t) { return t * t * t; };
var easeInOut   = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
var easeInOutQ  = function (t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };

var reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

/* ============================================================
   几何：两组数据都由 Python 从素材图里量出
   RIDGE  后层山脊（每列最上方的非白像素）
   FRONT  前层黑山轮廓（每列最上方的 lum<60 像素）—— 这一层才是画面里的"山川"
   ============================================================ */
var RIDGE = [
  [0.0000,0.7664],[0.0499,0.7697],[0.0998,0.7672],[0.1496,0.7622],[0.1995,0.7563],
  [0.2494,0.7647],[0.2993,0.7630],[0.3492,0.7479],[0.3990,0.7412],[0.4489,0.7437],
  [0.4988,0.7563],[0.5499,0.7630],[0.5998,0.7580],[0.6496,0.7479],[0.6995,0.7529],
  [0.7494,0.7664],[0.7993,0.7756],[0.8492,0.7807],[0.8990,0.7748],[0.9489,0.7639],
  [0.9988,0.7571]
];
var FRONT = [
  [0.0000,0.8496],[0.0499,0.8429],[0.0998,0.8345],[0.1496,0.8261],[0.1995,0.8168],
  [0.2494,0.8050],[0.2993,0.7899],[0.3492,0.7756],[0.3990,0.7731],[0.4489,0.7782],
  [0.4988,0.7941],[0.5499,0.8092],[0.5998,0.8193],[0.6496,0.8202],[0.6995,0.8277],
  [0.7494,0.8437],[0.7993,0.8613],[0.8492,0.8714],[0.8990,0.8765],[0.9489,0.8807],
  [0.9988,1.0000]
];
var SRC_W = 842, SRC_H = 1190;      // 山素材原始尺寸
var STAGE_W = 448, STAGE_H = 960;   // 舞台坐标（与 SVG viewBox 一致）
/* 山：落位照原片逐帧量出的数值 —— 山脊最高点 x=230 / y=430，山脚 500 起化雾、700 散尽 */
var MOUNT_X = -106, MOUNT_Y = -490, MOUNT_W = 841.9, MOUNT_H = 1190;
var PERSON_H = 430;                 // 人影高度（与原片一致）

function mountRect() { return { x: MOUNT_X, y: MOUNT_Y, w: MOUNT_W, h: MOUNT_H }; }
function sampleY(table, x) {                    // 舞台 x → 该层轮廓 y（线性插值）
  var r = mountRect(), u = (x - r.x) / r.w;
  if (u <= table[0][0]) return r.y + table[0][1] * r.h;
  for (var i = 1; i < table.length; i++) {
    if (u <= table[i][0]) {
      var k = (u - table[i - 1][0]) / (table[i][0] - table[i - 1][0]);
      return r.y + lerp(table[i - 1][1], table[i][1], k) * r.h;
    }
  }
  return r.y + table[table.length - 1][1] * r.h;
}
/* 航线：台风出现在"山的右侧上方"，在那儿旋着向右上划走 —— 取自原片实测
   （原片开场第 1 帧：风中心在画面宽 82%、高 35% 处，随后缩小淡出）
   这条线同时也是一笔墨：它在风身后拖出，风走了还留一道痕。 */
function flyPts() {
  return [
    [332, 402], [368, 384], [404, 358], [438, 322], [468, 282]
  ];   // 从右肩上方起，向右上抬起划走（墨迹跟着成为一道上扬的弧）
}
/* Catmull-Rom → 三次贝塞尔 */
function smoothPath(pts) {
  if (pts.length < 2) return '';
  var d = 'M' + pts[0][0].toFixed(2) + ',' + pts[0][1].toFixed(2);
  for (var i = 0; i < pts.length - 1; i++) {
    var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || pts[i + 1];
    var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ' C' + c1x.toFixed(2) + ',' + c1y.toFixed(2) + ' ' +
                c2x.toFixed(2) + ',' + c2y.toFixed(2) + ' ' +
                p2[0].toFixed(2) + ',' + p2[1].toFixed(2);
  }
  return d;
}
/* ============================================================
   ① 首屏
   ============================================================ */
var flyPath = $('#flyPath'), typhoon = $('#typhoon'), personEl = $('#personImg');
var flyLen = 0, T0 = 0;
var FLY_START = 1.20, FLY_DUR = 2.20;      // 台风出现时刻 / 划走时长（秒）；走完才轮到题目和人

/* 人影：站在山脚化雾之后的下方留白里，头顶不越过山脚 */
function placePerson() {
  if (!personEl) return;
  var H = PERSON_H, RATIO = 655 / 1400, FEET_X = 100, FEET_U = 0.2492;
  var w = H * RATIO, x = FEET_X - FEET_U * w;
  var y = STAGE_H - H + 6;                        // 脚踩出底边，与原片一样
  personEl.setAttribute('x', x.toFixed(1));
  personEl.setAttribute('y', y.toFixed(1));
  personEl.setAttribute('width', w.toFixed(1));
  personEl.setAttribute('height', String(H));
}

/* 山脚飞白：沿山体下沿撒一层大小不一的墨点，模仿原片山脚的溅墨 */
function buildSplatter() {
  var g = $('#splatter'); if (!g) return;
  var seed = 20261001;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  var out = '';
  for (var i = 0; i < 104; i++) {                      // 细密的墨点，贴着山体下沿
    var x = -14 + Math.pow(rnd(), 1.15) * (STAGE_W + 28);
    var y = 500 + rnd() * 160;                     // 沿着山脚化雾的那一段
    out += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' +
           (0.5 + Math.pow(rnd(), 2.6) * 2.2).toFixed(2) + '" opacity="' + (0.10 + rnd() * 0.42).toFixed(2) + '"/>';
  }
  for (var j = 0; j < 10; j++) {                       // 几团很淡的水渍
    var x2 = -14 + rnd() * (STAGE_W + 28);
    var y2 = 505 + rnd() * 140;
    out += '<ellipse cx="' + x2.toFixed(1) + '" cy="' + y2.toFixed(1) + '" rx="' + (3 + rnd() * 4).toFixed(1) +
           '" ry="' + (1.5 + rnd() * 2).toFixed(1) + '" opacity="' + (0.04 + rnd() * 0.05).toFixed(2) + '"/>';
  }
  g.innerHTML = out;
}

function initCover() {
  placePerson();
  buildSplatter();
  if (!flyPath) return;
  flyPath.setAttribute('d', smoothPath(flyPts()));
  flyLen = flyPath.getTotalLength();
  if (reduced) {
    if (typhoon) typhoon.style.display = 'none';
    return;
  }
  T0 = performance.now();
  requestAnimationFrame(coverTick);
}

function coverTick(now) {
  var t = (now - T0) / 1000;
  var u = clamp((t - FLY_START) / FLY_DUR, 0, 1);
  var s = easeInOutQ(u);

  if (u > 0) {
    var pt = flyPath.getPointAtLength(flyLen * s);
    var sc = 1 - 0.58 * s;                     // 一边划走一边缩小
    typhoon.setAttribute('transform',
      'translate(' + pt.x.toFixed(2) + ',' + pt.y.toFixed(2) + ') rotate(' + (t * 13).toFixed(1) +
      ') scale(' + sc.toFixed(3) + ')');
    typhoon.style.opacity = String(clamp(Math.min(s / 0.05, (1 - s) / 0.28), 0, 1));
  }
  if (u < 1) requestAnimationFrame(coverTick);
  else typhoon.style.opacity = '0';           // 飘走就没了，不留任何痕
}

/* ============================================================
   ② 第二页：文案吸进风眼
   ============================================================ */
var sec2 = $('#p2'), sticky = $('#sticky2'), cta = $('#cta'), hint2 = $('#hint2');
var IMG_W = 928, IMG_H = 1117;         // 海浪漩涡素材原始尺寸
var EYE_U = 0.45, EYE_V = 0.48;        // 实测风眼位置（图片比例坐标）

var suckItems = [], eye = { x: 0, y: 0 };

function measureEye() {
  if (!sticky) return;
  var cw = sticky.clientWidth, ch = sticky.clientHeight;
  var sc = Math.max(cw / IMG_W, ch / IMG_H);          // cover
  var dw = IMG_W * sc, dh = IMG_H * sc;
  eye.x = (cw - dw) / 2 + EYE_U * dw;
  eye.y = (ch - dh) / 2 + EYE_V * dh;

  suckItems = $$('.suck').map(function (el) {
    var win = (el.dataset.win || '0.1,0.5').split(',').map(Number);
    var w = el.offsetWidth, h = el.offsetHeight;
    var dx = el.offsetLeft + w / 2 - eye.x, dy = el.offsetTop + h / 2 - eye.y;
    return {
      el: el, w: w, h: h, ox: el.offsetLeft, oy: el.offsetTop,
      r0: Math.hypot(dx, dy), a0: Math.atan2(dy, dx),
      win: win, spin: parseFloat(el.dataset.spin || '1.8')
    };
  });
}

/* 进入第二页视口后按原片量出的秒表依次出现，全部留在画面上（与原片一致）
   时刻写在各自的 data-t 上：超强台风 0.5 / 城乡紧急 2.0 / 城市内涝 2.5 /
   多方力量 3.0 / 大字标语 4.2 / 点击屏幕 6.0（秒） */
/* 慢网保护：先等关键图加载完再开始念秒表。
   否则在 GitHub Pages 这种高延迟链路上，动画会在背景还没出来时就开始跑，
   看着就是"字先蹦出来、图后蹦出来"，像坏了。最多等 8 秒，等不到也照常开始。 */
function whenImagesReady(urls, cb) {
  var left = urls.length, done = false;
  function fin() { if (!done) { done = true; cb(); } }
  if (!left) { fin(); return; }
  urls.forEach(function (u) {
    var im = new Image();
    im.onload = im.onerror = function () { if (--left <= 0) fin(); };
    im.src = u;
  });
  setTimeout(fin, 8000);
}

var eyeStarted = false;
function startEye() {
  if (eyeStarted) return;
  eyeStarted = true;
  whenImagesReady(['assets/img/bg-eye.webp'], function () {
    $$('.suck').forEach(function (el) {
      var t = parseFloat(el.dataset.t || '0.5') * 1000;
      setTimeout(function () { el.classList.add('in'); }, t);
    });
    if (cta) setTimeout(function () { cta.classList.add('show'); },
                       parseFloat(cta.dataset.t || '6') * 1000);
  });
}

/* 点击底部提示 → 画面上所有文案被吸进风眼 → 滑到第三页 */
var sucking = false;
function playSuck() {
  if (sucking) return;
  sucking = true;
  var t0 = performance.now(), D = 1200;
  (function step(now) {
    var p = clamp((now - t0) / D, 0, 1);
    applySuck(easeInCubic(p) * 1.35 > 1 ? 1 : easeInCubic(p) * 1.35);
    if (p < 1) requestAnimationFrame(step);
    else if (secs[2]) glideTo(secs[2].offsetTop);
  })(performance.now());
}

function applySuck(p) {
  for (var i = 0; i < suckItems.length; i++) {
    var it = suckItems[i], el = it.el;
    var u = clamp((p - it.win[0]) / (it.win[1] - it.win[0]), 0, 1);
    if (u <= 0) { el.style.transform = ''; continue; }
    var ue = easeInCubic(u);
    var r = it.r0 * (1 - ue);
    var a = it.a0 + ue * it.spin;
    var x = eye.x + Math.cos(a) * r - it.w / 2 - it.ox;
    var y = eye.y + Math.sin(a) * r - it.h / 2 - it.oy;
    el.style.opacity = String(u > 0.74 ? 1 - (u - 0.74) / 0.26 : 1);
    el.style.transform =
      'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)' +
      ' rotate(' + (it.spin * ue * 0.45).toFixed(3) + 'rad)' +
      ' scale(' + (1 - 0.9 * ue).toFixed(3) + ')';
  }
  if (hint2) hint2.classList.toggle('gone', p > 0.02);
}

/* ============================================================
   ③ 第三页：温度、形成过程、路径与统计面板
   ============================================================ */
function initP3() {
  var root = $('#p3');
  if (!root) return;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        root.classList.toggle('is-current', entry.isIntersecting && entry.intersectionRatio > 0.5);
      });
    }, { threshold: [0.5] }).observe(root);
  }
  var scroll = $('#p3Scroll'), origin = $('.p3-origin'), originScene = $('#p3OriginScene'), waveHit = $('#p3WaveHit'), study = $('#p3OriginStudy'), studyBack = $('#p3StudyBack'), thermoStage = $('#p3ThermoStage'), thermo = $('#p3Thermo'), mercury = $('#p3Mercury'), temp = $('#p3Temp'), thermoValue = $('#p3ThermoValue');
  var originRoute = $('#p3OriginRoute'), originRouteMap = $('#p3OriginRouteMap'), originRouteCopy = $('#p3OriginRouteCopy');
  var video = $('#p3OriginReveal .p3-origin-video video'), originReveal = $('#p3OriginReveal');
  var copy = $('#p3OriginCopy'), list = $('#p3ProcessList'), originNext = $('.p3-origin-next'), processBack = $('#p3ProcessBack'), evidenceBack = $('#p3EvidenceBack');
  var flightLayer = $('#p3FlightLayer'), flightPathEl = $('#p3FlightPath'), flightIcon = $('#p3TyphoonFlight'), mapHit = $('#p3MapHit');
  var treeFlightPathEl = $('#p3TreeFlightPath'), treeFlightIcon = $('#p3TreeTyphoonFlight'), treeHit = $('#p3TreeHit'), impactScene = $('#p3ImpactScene');
  var greatWallFlightPathEl = $('#p3GreatWallFlightPath'), greatWallFlightIcon = $('#p3GreatWallTyphoonFlight'), greatWallHit = $('#p3GreatWallHit');
  var impactChainTrigger = $('#p3ImpactChainTrigger'), impactChain = $('#p3ImpactChain');
  var impactReturn = $('#p3ImpactReturn'), impactBack = $('#p3ImpactBack');
  var puzzleBoard = $('#p3PuzzleBoard'), puzzleGrid = $('#p3PuzzleGrid'), puzzleFull = $('#p3PuzzleFull'), mapgameBack = $('#p3MapgameBack');
  var puzzleCountdown = $('#p3PuzzleCountdown'), puzzleStart = $('#p3PuzzleStart'), puzzleStatus = $('#p3PuzzleStatus');
  var detail = $('#p3TyphoonDetail'), detailClose = $('#p3DetailClose'), historyScene = $('#p3HistoryScene'), historyBlock = $('#p3HistoryBlock');
  var views = $$('.p3-view'), rail = $$('.p3-rail [data-p3-view]');
  function hideFlightLayer() {
    if (!flightLayer) return;
    flightLayer.classList.remove('is-playing', 'is-arrived', 'is-tree-playing', 'is-tree-arrived', 'is-greatwall-playing', 'is-greatwall-arrived');
    flightLayer.style.visibility = 'hidden';
  }
  hideFlightLayer();
  var processText = [
    ['孕育阶段', '热带有大量湿热上升空气形成弱对流，在地转偏向力影响下形成初步云团。'],
    ['发展阶段', '低压中心不断吸收水汽，风力增强，升级为热带风暴、强热带风暴。'],
    ['成熟阶段', '中心附近风力高达12级并具有明显且规整的台风眼。'],
    ['消亡阶段', '台风登陆后因摩擦力迅速增大而逐渐消散。']
  ];
  var originFactors = [
    ['assets/p3/707079f00a737da677eb798019e8a465.png', '广阔且温暖的洋面', '温度超过26.5摄氏度，深度大于60米'],
    ['assets/p3/7a29fb60ed7ceb1b7f4a4e0ba88116a0.png', '地转偏向力', '地球自转形成的偏向力，是让气流旋转起来的关键'],
    ['assets/p3/bf27c365e0684832c527596d57ee7b9b.png', '低空风切变', '高低空风速差异小'],
    ['assets/p3/fbe4cfa605e0fab807689fc773301980.png', '充沛的水汽供应', '热带洋面蒸发旺盛，为台风形成提供充足水汽'],
    ['assets/img/typhoon-ink.webp', '初始扰动', '大气中必须存在一个具备微弱气旋性环流的低压扰动或云团，将周围的水汽初步汇聚起来。']
  ];
  if (list) list.innerHTML = processText.map(function (x, i) {
    return '<p style="animation-delay:' + (i * 90) + 'ms"><strong>' + x[0] + '：</strong>' + x[1] + '</p>';
  }).join('');

  var value = 20, unlocked = false, factorTimers = [];
  function enterOriginStudy() {
    if (!originScene || !study) return;
    originScene.hidden = true;
    study.hidden = false;
    if (scroll) scroll.scrollTop = 0;
    if (thermo) thermo.focus({ preventScroll: true });
  }
  function resetOriginStudy() {
    unlocked = false;
    factorTimers.forEach(clearTimeout);
    factorTimers = [];
    if (thermoStage) thermoStage.classList.remove('is-hidden');
    if (originReveal) { originReveal.hidden = true; originReveal.classList.remove('is-revealing'); }
    if (copy) copy.innerHTML = '';
    if (originNext) originNext.hidden = true;
    if (video) { video.pause(); video.currentTime = 0; }
    setTemp(20);
  }
  function revealOrigin() {
    if (unlocked || value < 26.5) return;
    unlocked = true;
    if (originReveal) {
      originReveal.hidden = false;
      originReveal.classList.add('is-revealing');
    }
    if (thermoStage) thermoStage.classList.add('is-hidden');
    if (video) { video.currentTime = 0; video.play().catch(function () {}); }
    if (copy) {
      copy.innerHTML = '';
      factorTimers.forEach(clearTimeout);
      factorTimers = [];
      originFactors.forEach(function (factor, i) {
        factorTimers.push(setTimeout(function () {
          var row = document.createElement('article');
          row.className = 'p3-factor';
          row.style.setProperty('--factor-delay', (i * 70) + 'ms');
          row.innerHTML = '<span class="p3-factor-icon" aria-hidden="true"><img src="' + factor[0] + '" alt=""></span><p><strong>' + factor[1] + '：</strong>' + factor[2] + '</p>';
          copy.appendChild(row);
          if (i === originFactors.length - 1 && originNext) originNext.hidden = false;
        }, 650 + i * 900));
      });
    }
  }
  function setTemp(v) {
    value = clamp(v, 20, 30);
    var pct = (value - 20) / 10;
    if (mercury) mercury.style.height = (18 + pct * 66).toFixed(1) + '%';
    if (temp) temp.textContent = value.toFixed(1) + '°C';
    if (thermoValue) thermoValue.textContent = '摄氏度：' + value.toFixed(1) + '°';
    if (thermo) {
      thermo.setAttribute('aria-valuenow', value.toFixed(1));
      thermo.setAttribute('aria-valuetext', value.toFixed(1) + '摄氏度');
      thermo.classList.toggle('hot', value >= 26.5);
    }
  }
  function tempFromY(clientY) {
    if (!thermo) return;
    var r = thermo.getBoundingClientRect();
    var p = clamp(1 - (clientY - r.top - r.height * .16) / (r.height * .66), 0, 1);
    setTemp(20 + p * 10);
  }
  if (waveHit) waveHit.addEventListener('click', enterOriginStudy);
  if (studyBack) studyBack.addEventListener('click', function () {
    if (study) study.hidden = true;
    if (originScene) originScene.hidden = false;
    resetOriginStudy();
    if (waveHit) waveHit.focus({ preventScroll: true });
  });
  if (thermo) {
    thermo.addEventListener('pointerdown', function (e) { thermo.setPointerCapture(e.pointerId); tempFromY(e.clientY); revealOrigin(); });
    thermo.addEventListener('pointermove', function (e) { if (e.buttons) { tempFromY(e.clientY); revealOrigin(); } });
    thermo.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); setTemp(value + .5); revealOrigin(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); setTemp(value - .5); revealOrigin(); }
    });
  }
  setTemp(value);

  var flightRun = 0, routeToken = 0;
  function playFlight() {
    if (!flightPathEl || !flightIcon || (mapHit && mapHit.classList.contains('is-playing'))) return;
    // 从海浪形成页切到地图时，先清掉上一页的内容，避免路径动画期间
    // 露出旧的温度计/形成条件画面。
    if (study) study.hidden = true;
    if (originScene) originScene.hidden = false;
    resetOriginStudy();
    // 目标页立即切入，路径动画只负责播放过渡，不再阻塞页面切换。
    show('mapgame');
    var viewToken = routeToken;
    var run = ++flightRun;
    var length = flightPathEl.getTotalLength();
    var duration = reduced ? 1 : 1100;
    if (flightLayer) {
      flightLayer.style.visibility = 'visible';
      flightLayer.classList.remove('is-arrived');
      flightLayer.classList.add('is-playing');
    }
    if (mapHit) {
      mapHit.classList.add('is-playing');
      mapHit.setAttribute('aria-busy', 'true');
    }
    var t0 = performance.now();
    function step(now) {
      if (run !== flightRun || viewToken !== routeToken) return;
      var p = clamp((now - t0) / duration, 0, 1);
      var eased = easeInOutQ(p);
      var point = flightPathEl.getPointAtLength(length * eased);
      flightIcon.setAttribute('transform', 'translate(' + point.x.toFixed(2) + ' ' + point.y.toFixed(2) + ')');
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        if (flightLayer) {
          flightLayer.classList.remove('is-playing');
          flightLayer.classList.add('is-arrived');
        }
        if (mapHit) {
          mapHit.classList.remove('is-playing');
          mapHit.removeAttribute('aria-busy');
        }
        if (viewToken === routeToken) show('mapgame');
      }
    }
    requestAnimationFrame(step);
  }
  if (mapHit) mapHit.addEventListener('click', playFlight);

  var treeFlightRun = 0;
  function playTreeFlight() {
    if (!treeFlightPathEl || !treeFlightIcon || (treeHit && treeHit.classList.contains('is-playing'))) return;
    if (study) study.hidden = true;
    if (originScene) originScene.hidden = false;
    resetOriginStudy();
    setImpactStep('question');
    show('impact');
    var viewToken = routeToken;
    var run = ++treeFlightRun;
    var length = treeFlightPathEl.getTotalLength();
    var duration = reduced ? 1 : 1700;
    if (flightLayer) {
      flightLayer.style.visibility = 'visible';
      flightLayer.classList.remove('is-tree-arrived');
      flightLayer.classList.add('is-tree-playing');
    }
    if (treeHit) {
      treeHit.classList.add('is-playing');
      treeHit.setAttribute('aria-busy', 'true');
    }
    var t0 = performance.now();
    function step(now) {
      if (run !== treeFlightRun || viewToken !== routeToken) return;
      var p = clamp((now - t0) / duration, 0, 1);
      var eased = easeInOutQ(p);
      var point = treeFlightPathEl.getPointAtLength(length * eased);
      treeFlightIcon.setAttribute('transform', 'translate(' + point.x.toFixed(2) + ' ' + point.y.toFixed(2) + ')');
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        if (flightLayer) {
          flightLayer.classList.remove('is-tree-playing');
          flightLayer.classList.add('is-tree-arrived');
        }
        if (treeHit) {
          treeHit.classList.remove('is-playing');
          treeHit.removeAttribute('aria-busy');
        }
        window.setTimeout(function () {
          if (viewToken !== routeToken) return;
          setImpactStep('question');
          show('impact');
        }, reduced ? 0 : 160);
      }
    }
    requestAnimationFrame(step);
  }
  if (treeHit) treeHit.addEventListener('click', playTreeFlight);

  var greatWallFlightRun = 0;
  function playGreatWallFlight() {
    if (!greatWallFlightPathEl || !greatWallFlightIcon || (greatWallHit && greatWallHit.classList.contains('is-playing'))) return;
    if (study) study.hidden = true;
    if (originScene) originScene.hidden = false;
    resetOriginStudy();
    show('after');
    var viewToken = routeToken;
    var run = ++greatWallFlightRun;
    var length = greatWallFlightPathEl.getTotalLength();
    var duration = reduced ? 1 : 1900;
    if (flightLayer) {
      flightLayer.style.visibility = 'visible';
      flightLayer.classList.remove('is-tree-playing', 'is-tree-arrived', 'is-arrived');
      flightLayer.classList.remove('is-greatwall-arrived');
      flightLayer.classList.add('is-greatwall-playing');
    }
    if (greatWallHit) {
      greatWallHit.classList.add('is-playing');
      greatWallHit.setAttribute('aria-busy', 'true');
    }
    var t0 = performance.now();
    function step(now) {
      if (run !== greatWallFlightRun || viewToken !== routeToken) return;
      var p = clamp((now - t0) / duration, 0, 1);
      var eased = easeInOutQ(p);
      var point = greatWallFlightPathEl.getPointAtLength(length * eased);
      greatWallFlightIcon.setAttribute('transform', 'translate(' + point.x.toFixed(2) + ' ' + point.y.toFixed(2) + ')');
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        if (flightLayer) {
          flightLayer.classList.remove('is-greatwall-playing');
          flightLayer.classList.add('is-greatwall-arrived');
        }
        if (greatWallHit) {
          greatWallHit.classList.remove('is-playing');
          greatWallHit.removeAttribute('aria-busy');
        }
        window.setTimeout(function () {
          if (viewToken === routeToken) show('after');
        }, reduced ? 0 : 220);
      }
    }
    requestAnimationFrame(step);
  }
  if (greatWallHit) greatWallHit.addEventListener('click', playGreatWallFlight);

  var impactStep = 'question';
  var impactDialogs = $$('.p3-impact-dialog');
  var impactStatistics = $('.p3-impact-statistics');
  function setImpactStep(step) {
    impactStep = step;
    if (impactScene) impactScene.dataset.impactStep = step;
    impactDialogs.forEach(function (dialog) {
      dialog.hidden = dialog.dataset.impactDialog !== step;
    });
    $$('[data-impact-person]').forEach(function (person) {
      person.hidden = person.dataset.impactPerson !== step;
    });
    if (impactChainTrigger) impactChainTrigger.hidden = step !== 'downstream';
    if (step !== 'downstream' && impactChain) {
      impactChain.hidden = true;
      if (impactStatistics) impactStatistics.hidden = true;
      if (impactScene) impactScene.dataset.chainOpen = 'false';
    }
    if (step === 'question') {
      var readingContent = impactScene && impactScene.closest('.chapter-content');
      if (readingContent) readingContent.scrollTop = 0;
    }
  }
  impactDialogs.forEach(function (dialog) {
    var bubble = dialog.querySelector('.p3-impact-bubble');
    if (!bubble) return;
    bubble.addEventListener('click', function () {
      if (impactStep === 'question') {
        setImpactStep('fisherman');
      } else if (impactStep === 'fisherman') {
        setImpactStep('city');
      } else if (impactStep === 'city') {
        setImpactStep('village');
      } else if (impactStep === 'village') {
        setImpactStep('downstream');
      }
      var active = document.querySelector('.p3-impact-dialog:not([hidden]) .p3-impact-bubble');
      if (active) active.focus({ preventScroll: true });
    });
  });
  if (impactChainTrigger) impactChainTrigger.addEventListener('click', function () {
    if (impactStep !== 'downstream' || !impactChain) return;
    impactChain.hidden = false;
    if (impactStatistics) impactStatistics.hidden = false;
    if (impactScene) impactScene.dataset.chainOpen = 'true';
    impactChainTrigger.hidden = true;
    window.setTimeout(function () {
      var lead = impactChain.querySelector('.p3-impact-chain-lead');
      if (lead) lead.setAttribute('tabindex', '-1');
      if (lead) lead.focus({ preventScroll: true });
    }, 40);
  });
  if (impactReturn) impactReturn.addEventListener('click', function () {
    show('origin');
    if (scroll) scroll.scrollTop = 0;
    if (greatWallHit) greatWallHit.focus({ preventScroll: true });
  });
  if (impactBack) impactBack.addEventListener('click', function () {
    show('origin');
    if (scroll) scroll.scrollTop = 0;
    if (greatWallHit) greatWallHit.focus({ preventScroll: true });
  });
  setImpactStep('question');

  $$('.p3-story-card').forEach(function (card) {
    function flipStoryCard() {
      var flipped = card.classList.toggle('is-flipped');
      card.setAttribute('aria-pressed', flipped ? 'true' : 'false');
    }
    card.addEventListener('click', flipStoryCard);
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        flipStoryCard();
      }
    });
  });

  var prepRegionButtons = $$('[data-prep-region]');
  var prepPanels = $$('[data-prep-panel]');
  var prepCarousels = prepPanels.map(function (panel) {
    var viewport = panel.querySelector('.p3-prep-images');
    var images = Array.prototype.slice.call(viewport.querySelectorAll('img'));
    var current = 0, scrollTimer = 0;
    viewport.tabIndex = 0;
    viewport.setAttribute('role', 'group');
    viewport.setAttribute('aria-roledescription', '轮播图');
    viewport.setAttribute('aria-label', panel.querySelector('header strong').textContent);
    images.forEach(function (image) { image.draggable = false; });

    var controls = document.createElement('div');
    controls.className = 'p3-prep-controls';
    controls.innerHTML = '<button class="p3-prep-arrow" type="button" aria-label="上一张档案卡">‹</button><div class="p3-prep-dots"></div><button class="p3-prep-arrow" type="button" aria-label="下一张档案卡">›</button>';
    panel.appendChild(controls);
    var caption = document.createElement('p');
    caption.className = 'p3-prep-caption';
    caption.setAttribute('aria-live', 'polite');
    panel.appendChild(caption);
    var dots = images.map(function (image, index) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', '查看第' + (index + 1) + '张：' + image.alt);
      dot.addEventListener('click', function () { go(index, true); });
      controls.querySelector('.p3-prep-dots').appendChild(dot);
      return dot;
    });
    function update() {
      dots.forEach(function (dot, index) { dot.setAttribute('aria-current', index === current ? 'true' : 'false'); });
      caption.textContent = images[current].alt + ' · ' + (current + 1) + ' / ' + images.length;
    }
    function go(index, animate) {
      current = (index + images.length) % images.length;
      clearTimeout(scrollTimer);
      update();
      if (!viewport.clientWidth) return;
      var left = current * viewport.clientWidth;
      if (animate && !reduced && viewport.scrollTo) viewport.scrollTo({ left: left, behavior: 'smooth' });
      else viewport.scrollLeft = left;
    }
    controls.querySelectorAll('.p3-prep-arrow')[0].addEventListener('click', function () { go(current - 1, true); });
    controls.querySelectorAll('.p3-prep-arrow')[1].addEventListener('click', function () { go(current + 1, true); });
    viewport.addEventListener('scroll', function () {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () {
        if (!viewport.clientWidth) return;
        current = clamp(Math.round(viewport.scrollLeft / viewport.clientWidth), 0, images.length - 1);
        update();
      }, 120);
    }, { passive: true });
    viewport.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      go(current + (event.key === 'ArrowRight' ? 1 : -1), true);
    });
    function align() { go(current, false); }
    window.addEventListener('resize', align);
    update();
    return { panel: panel, align: align };
  });
  function setPrepRegion(region, bringIntoView) {
    prepRegionButtons.forEach(function (button) {
      var active = button.dataset.prepRegion === region;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    prepPanels.forEach(function (panel) {
      panel.hidden = panel.dataset.prepPanel !== region;
      panel.classList.toggle('is-active', panel.dataset.prepPanel === region);
    });
    prepCarousels.forEach(function (carousel) { if (!carousel.panel.hidden) carousel.align(); });

    // 点完区域要立刻看见结果：把「防灾准备档案」标题连同档案卡一起滚到眼前。
    // 否则按钮按了却停在介绍文字和地图上，得自己往下滑才看得到档案，很割裂。
    if (!bringIntoView) return;
    var shown = null;
    prepPanels.forEach(function (panel) { if (!panel.hidden) shown = panel; });
    var scroller = shown && shown.closest('.chapter-content');
    if (!scroller) return;
    var anchor = scroller.querySelector('.chapter-heading') || shown;
    var top = anchor.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 10;
    scroller.scrollTo({ top: Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' });
  }
  prepRegionButtons.forEach(function (button) {
    button.addEventListener('click', function () { setPrepRegion(button.dataset.prepRegion, true); });
  });
  setPrepRegion('coastal');

  var profile = $('#p3Profile'), archiveOpen = $('#p3ArchiveOpen'), archiveSeal = $('#p3ArchiveSeal'), finale = $('#p3Finale');
  var profileRisk = $('#p3ProfileRisk');
  function setProfileRegion(region) {
    if (!profileRisk) return;
    var text = region === 'inland' ? '山洪、滑坡、泥石流、强降雨、交通阻断' : '风暴潮、海水倒灌、城市内涝、大风灾害';
    profileRisk.innerHTML = '<strong>我最需要防范：</strong><span>' + text + '</span>';
  }
  $$('input[name="p3Region"]').forEach(function (radio) {
    radio.addEventListener('change', function () { if (radio.checked) setProfileRegion(radio.value); });
  });
  if (archiveOpen) archiveOpen.addEventListener('click', function () {
    if (finale) finale.hidden = true;
    if (profile) {
      profile.hidden = false;
    }
    show('archive');
    var profileContent = profile && profile.querySelector('.chapter-content');
    if (profileContent) profileContent.scrollTop = 0;
    var first = profile && profile.querySelector('input[name="p3Region"]');
    if (first) first.focus({ preventScroll: true });
  });
  if (archiveSeal) archiveSeal.addEventListener('click', function () {
    var checked = $$('.p3-profile-prep input[type="checkbox"]:checked').map(function (input) { return input.value; });
    var region = $('input[name="p3Region"]:checked');
    var regionText = region && region.value === 'inland' ? '内陆' : '沿海';
    if (archiveSeal) archiveSeal.innerHTML = '档案已封存 · ' + regionText + ' <span>✦</span>';
    if (checked.length === 0) archiveSeal.setAttribute('aria-label', '档案已封存，建议至少选择一项准备事项');
    if (profile) profile.hidden = true;
    if (finale) {
      finale.hidden = false;
      finale.classList.remove('is-opening');
      void finale.offsetWidth;
      finale.classList.add('is-opening');
    }
    if (scroll) scroll.scrollTop = 0;
  });
  var afterBack = $('#p3AfterBack');
  if (afterBack) afterBack.addEventListener('click', function () {
    show('origin');
    if (scroll) scroll.scrollTop = 0;
    if (greatWallHit) greatWallHit.focus({ preventScroll: true });
  });
  var nextWind = $('#p3NextWind');
  if (nextWind) nextWind.addEventListener('click', function () {
    if (finale) finale.hidden = true;
    if (profile) profile.hidden = true;
    show('origin');
    root.dispatchEvent(new CustomEvent('p3-return-menu'));
  });

  var puzzleMode = 'ready';
  var puzzleOrder = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  var puzzleTimer = null;
  var dragState = null;
  var completedAt = 0;
  function puzzleSolved() {
    return puzzleOrder.every(function (piece, slot) { return piece === slot; });
  }
  function setPuzzleSolved() {
    puzzleMode = 'complete';
    completedAt = performance.now();
    if (puzzleStatus) puzzleStatus.textContent = '拼图完成。点击地图，下方显示年份路径。';
    if (puzzleBoard) {
      puzzleBoard.classList.remove('is-playing');
      puzzleBoard.classList.add('is-complete');
      puzzleBoard.setAttribute('aria-label', '拼图已完成，点击地图查看下方年份路径');
    }
    if (puzzleGrid) puzzleGrid.hidden = true;
    if (puzzleFull) puzzleFull.hidden = false;
    if (puzzleStart) puzzleStart.hidden = true;
  }
  function revealHistoryBelowMap() {
    if (!historyBlock || puzzleMode !== 'complete') return;
    historyBlock.hidden = false;
    if (historyScene) {
      historyScene.classList.remove('is-entering');
      void historyScene.offsetWidth;
      historyScene.classList.add('is-entering');
    }
    if (puzzleStatus) puzzleStatus.textContent = '线路已展开。点击年份节点查看台风详情。';
    window.setTimeout(function () {
      if (window.P3Pages) window.P3Pages.goTo(historyBlock.querySelector('.chapter-page'), true);
      else historyBlock.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }, 40);
  }
  function tileLabel(piece, slot) {
    return '地图第' + (piece + 1) + '块，当前位置第' + (slot + 1) + '格。使用方向键移动';
  }
  function renderPuzzle(focusPiece) {
    if (!puzzleGrid) return;
    puzzleGrid.innerHTML = '';
    puzzleOrder.forEach(function (piece, slot) {
      var tile = document.createElement('button');
      var x = piece % 3, y = Math.floor(piece / 3);
      tile.type = 'button';
      tile.className = 'p3-puzzle-tile';
      tile.dataset.piece = String(piece);
      tile.dataset.slot = String(slot);
      tile.style.backgroundPosition = (x * 50) + '% ' + (y * 50) + '%';
      tile.setAttribute('aria-label', tileLabel(piece, slot));
      tile.addEventListener('pointerdown', onTilePointerDown);
      tile.addEventListener('pointermove', onTilePointerMove);
      tile.addEventListener('pointerup', onTilePointerUp);
      tile.addEventListener('pointercancel', onTilePointerCancel);
      tile.addEventListener('keydown', onTileKeyDown);
      puzzleGrid.appendChild(tile);
    });
    if (focusPiece !== undefined) {
      var focusTarget = $('.p3-puzzle-tile[data-piece="' + focusPiece + '"]', puzzleGrid);
      if (focusTarget) focusTarget.focus();
    }
  }
  function moveTileTo(from, to, focusPiece) {
    if (from === to || to < 0 || to > 8 || puzzleMode !== 'playing') return;
    var piece = puzzleOrder[from];
    puzzleOrder[from] = puzzleOrder[to];
    puzzleOrder[to] = piece;
    renderPuzzle(focusPiece === undefined ? piece : focusPiece);
    if (puzzleSolved()) setPuzzleSolved();
  }
  function slotAt(clientX, clientY) {
    var r = puzzleGrid.getBoundingClientRect();
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return -1;
    var col = Math.min(2, Math.floor((clientX - r.left) / r.width * 3));
    var row = Math.min(2, Math.floor((clientY - r.top) / r.height * 3));
    return row * 3 + col;
  }
  function onTilePointerDown(e) {
    if (puzzleMode !== 'playing' || !e.isPrimary) return;
    var tile = e.currentTarget;
    dragState = { tile: tile, slot: Number(tile.dataset.slot), piece: Number(tile.dataset.piece), x: e.clientX, y: e.clientY, moved: false };
    tile.setPointerCapture(e.pointerId);
    tile.classList.add('is-dragging');
    e.preventDefault();
  }
  function onTilePointerMove(e) {
    if (!dragState || dragState.tile !== e.currentTarget) return;
    var dx = e.clientX - dragState.x, dy = e.clientY - dragState.y;
    if (Math.abs(dx) + Math.abs(dy) > 8) dragState.moved = true;
    if (dragState.moved) dragState.tile.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(1.035)';
  }
  function onTilePointerUp(e) {
    if (!dragState || dragState.tile !== e.currentTarget) return;
    var current = dragState;
    current.tile.classList.remove('is-dragging');
    current.tile.style.transform = '';
    dragState = null;
    if (!current.moved) return;
    moveTileTo(current.slot, slotAt(e.clientX, e.clientY), current.piece);
  }
  function onTilePointerCancel(e) {
    if (!dragState || dragState.tile !== e.currentTarget) return;
    dragState.tile.classList.remove('is-dragging');
    dragState.tile.style.transform = '';
    dragState = null;
  }
  function onTileKeyDown(e) {
    var tile = e.currentTarget;
    var slot = Number(tile.dataset.slot), row = Math.floor(slot / 3), col = slot % 3, target = -1;
    if (puzzleMode === 'complete' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      revealHistoryBelowMap();
      return;
    }
    if (puzzleMode !== 'playing') return;
    if (e.key === 'ArrowLeft' && col > 0) target = slot - 1;
    if (e.key === 'ArrowRight' && col < 2) target = slot + 1;
    if (e.key === 'ArrowUp' && row > 0) target = slot - 3;
    if (e.key === 'ArrowDown' && row < 2) target = slot + 3;
    if (target >= 0) {
      e.preventDefault();
      moveTileTo(slot, target, Number(tile.dataset.piece));
    }
  }
  function startPuzzle() {
    if (puzzleMode !== 'ready' || !puzzleBoard) return;
    puzzleMode = 'memory';
    if (puzzleStart) puzzleStart.hidden = true;
    puzzleBoard.classList.add('is-memory');
    var seconds = 5;
    if (puzzleFull) puzzleFull.hidden = false;
    if (puzzleGrid) puzzleGrid.hidden = true;
    function beginPuzzle() {
      clearInterval(puzzleTimer);
      puzzleTimer = null;
      puzzleBoard.classList.remove('is-memory');
      puzzleBoard.classList.add('is-playing');
      puzzleMode = 'playing';
      if (puzzleCountdown) puzzleCountdown.hidden = true;
      if (puzzleFull) puzzleFull.hidden = true;
      if (puzzleGrid) puzzleGrid.hidden = false;
      puzzleOrder = [0, 1, 2, 3, 4, 5, 6, 7, 8];
      for (var i = puzzleOrder.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var swap = puzzleOrder[i]; puzzleOrder[i] = puzzleOrder[j]; puzzleOrder[j] = swap;
      }
      if (puzzleSolved()) { var firstPiece = puzzleOrder[0]; puzzleOrder[0] = puzzleOrder[1]; puzzleOrder[1] = firstPiece; }
      if (puzzleStatus) puzzleStatus.textContent = '拖动地图碎片拼回原图，也可以聚焦碎片后使用方向键';
      renderPuzzle();
    }
    function tick() {
      if (seconds > 0) {
        if (puzzleCountdown) { puzzleCountdown.hidden = false; puzzleCountdown.textContent = String(seconds); }
        if (puzzleStatus) puzzleStatus.textContent = '记忆地图：' + seconds + '秒';
        seconds--;
        return;
      }
      beginPuzzle();
    }
    tick();
    puzzleTimer = setInterval(tick, 1000);
  }
  if (puzzleBoard) {
    puzzleBoard.addEventListener('click', function () {
      if (puzzleMode === 'complete' && performance.now() - completedAt > 450) revealHistoryBelowMap();
    });
    puzzleBoard.addEventListener('keydown', function (e) {
      if (puzzleMode === 'complete' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        revealHistoryBelowMap();
      }
    });
  }
  if (puzzleStart) puzzleStart.addEventListener('click', startPuzzle);
  if (mapgameBack) mapgameBack.addEventListener('click', function () {
    flightRun++;
    treeFlightRun++;
    greatWallFlightRun++;
    if (flightLayer) flightLayer.classList.remove('is-playing', 'is-arrived', 'is-tree-playing', 'is-tree-arrived', 'is-greatwall-playing', 'is-greatwall-arrived');
    show('origin');
    if (scroll) scroll.scrollTop = 0;
    if (greatWallHit) greatWallHit.focus({ preventScroll: true });
  });

  var typhoonInfo = {
    rainbow: { year: '2015年', name: '彩虹', number: '1522', map: 'assets/p3/paths/rainbow.jpg', path: '生成于菲律宾吕宋岛附近海面，穿过吕宋岛进入南海后加强；10月4日14时10分前后在广东湛江市坡头区登陆。路径：菲律宾吕宋岛→南海北部→广东湛江→广西。', impact: '登陆时七级风圈半径约300公里，十级风圈约80公里。主要风雨影响：广东中西部、海南北部、广西东部、贵州南部。', loss: '广东、广西、海南等地受灾，死亡失踪约23人，紧急转移安置约20万人，直接经济损失约270亿元。湛江、茂名等地房屋倒塌、农田绝收，交通和电力一度中断。', media: ['assets/p3/source/news-5.mp4','assets/p3/source/news-0.mp4'], mediaCaption: ['现场视频','新闻视频'], ticker: '彩虹登陆湛江后，粤西多地出现强风、暴雨与风暴潮。' },
    meranti: { year: '2016年', name: '莫兰蒂', number: '1614', map: 'assets/p3/paths/meranti.jpg', path: '生成于西北太平洋关岛附近；9月15日3时05分在福建厦门翔安区登陆。路径：关岛附近→巴士海峡→台湾海峡→福建厦门→江西→安徽→江苏入海。', impact: '七级风圈半径约300—400公里，十级风圈约120—180公里。影响台湾、福建、浙江、江西、安徽、江苏等地。', loss: '福建、浙江、江西等受灾，死亡失踪约49人，紧急转移安置约50万人，直接经济损失约300亿元。厦门、泉州等地房屋倒塌、树木大面积倒伏、交通瘫痪。', media: ['assets/p3/source/news-5.mp4','assets/p3/source/news-14.mp4'], mediaCaption: ['风雨现场','新闻视频'], ticker: '莫兰蒂登陆闽南后，强风暴雨影响东南沿海与内陆多省。' },
    hato: { year: '2017年', name: '天鸽', number: '1713', map: 'assets/p3/paths/hato.jpg', path: '生成于菲律宾以东洋面；8月23日12时50分在广东珠海金湾区登陆。路径：菲律宾以东→南海北部→广东珠海→广西。', impact: '七级风圈半径约250公里，十级风圈约80公里。主要影响广东、香港、澳门、广西、贵州、云南。', loss: '死亡失踪约26人，紧急转移安置约27万人，直接经济损失约280亿元。珠海、澳门、中山等地房屋受损严重，停水停电、交通中断。', media: ['assets/p3/source/news-14.mp4','assets/p3/source/news-0.mp4'], mediaCaption: ['台风播报','现场视频'], ticker: '天鸽重创珠海、澳门，沿海城市进入全面防风状态。' },
    mangkhut: { year: '2018年', name: '山竹', number: '1822', map: 'assets/p3/paths/mangkhut.jpg', path: '生成于西北太平洋关岛附近；9月16日17时在广东江门台山市登陆。路径：关岛附近→菲律宾吕宋岛→南海→广东台山→广西→贵州。', impact: '七级风圈半径500公里以上，十级风圈约200公里，属于风圈极大的台风。影响广东、香港、澳门、海南、广西、贵州、湖南、云南等地。', loss: '中国境内死亡失踪约5人，紧急转移安置约300万人，直接经济损失约300亿元。粤港澳等地树木倒伏、房屋损坏、交通大面积停运。', media: ['assets/p3/source/news-0.mp4','assets/p3/source/news-14.mp4'], mediaCaption: ['新闻视频','现场视频'], ticker: '山竹登陆华南，超大风圈与风暴潮造成广泛影响。' },
    lekima: { year: '2019年', name: '利奇马', number: '1909', map: 'assets/p3/paths/lekima.jpg', path: '生成于菲律宾以东洋面；8月10日1时45分在浙江温岭市城南镇登陆。路径：菲律宾以东→台湾以东→浙江温岭→江苏→山东→渤海。', impact: '七级风圈半径约400—500公里，十级风圈约100—150公里。影响浙江、上海、江苏、山东、安徽、福建、辽宁等地。', loss: '死亡失踪约70人，紧急转移安置约140万人，直接经济损失约537亿元。浙江、山东等地农田受淹、房屋倒塌、交通中断，山东寿光蔬菜基地严重受灾。', media: ['assets/p3/source/news-5.mp4','assets/p3/source/news-0.mp4'], mediaCaption: ['积水现场','新闻视频'], ticker: '利奇马北上影响华东，多地启动防汛与地质灾害应急响应。' },
    higos: { year: '2020年', name: '黑格比', number: '2004', map: 'assets/p3/paths/higos.jpg', path: '生成于菲律宾以东洋面；8月4日3时30分在浙江乐清市沿海登陆。路径：菲律宾以东→东海→浙江乐清→江苏→黄海。', impact: '七级风圈半径约200—300公里，十级风圈约50—80公里。主要影响浙江、上海、江苏、安徽。', loss: '死亡失踪约7人，紧急转移安置约20万人，直接经济损失约80亿元。浙江温州、台州等地房屋受损、农田被淹、交通短时中断。', media: ['assets/p3/source/news-14.mp4','assets/p3/source/news-5.mp4'], mediaCaption: ['沿海现场','新闻视频'], ticker: '黑格比登陆浙江后，华东沿海出现强风、暴雨和大浪。' },
    infa: { year: '2021年', name: '烟花', number: '2106', map: 'assets/p3/paths/infa.jpg', path: '生成于西北太平洋；7月25日12时30分在浙江舟山普陀区登陆，7月26日9时50分在浙江嘉兴平湖市再次登陆。路径：西北太平洋→浙江舟山→嘉兴→江苏→安徽→河南→山东。', impact: '七级风圈半径约300—400公里，十级风圈约100公里。影响浙江、上海、江苏、安徽、河南、山东等地；外围水汽还参与河南“7·20”极端暴雨。', loss: '死亡失踪约2人，紧急转移安置约50万人，直接经济损失约100亿元。浙江、上海、江苏等地城市内涝、农田受淹、交通停运。', media: ['assets/p3/source/news-0.mp4','assets/p3/source/news-5.mp4'], mediaCaption: ['城市积水','现场视频'], ticker: '烟花移动缓慢，持续风雨给长三角防汛带来压力。' },
    muifa: { year: '2022年', name: '梅花', number: '2212', map: 'assets/p3/paths/muifa.jpg', path: '生成于西北太平洋；9月14日20时30分在浙江舟山普陀区登陆，15日0时30分在上海奉贤区再次登陆，16日0时在山东青岛第三次登陆，16日12时40分在辽宁大连第四次登陆。路径：西北太平洋→东海→浙江→上海→山东→辽宁。', impact: '七级风圈半径约300公里，十级风圈约80—120公里。影响浙江、上海、江苏、山东、辽宁、吉林等地。', loss: '死亡失踪较少，紧急转移安置约40万人，直接经济损失约100亿元。浙江、上海、山东、辽宁等地农田受淹、房屋损坏、港口和交通受影响。', media: ['assets/p3/source/news-14.mp4','assets/p3/source/news-0.mp4'], mediaCaption: ['海面现场','新闻视频'], ticker: '梅花多次登陆，影响范围跨越长三角、山东和辽宁。' },
    dusurui: { year: '2023年', name: '杜苏芮', number: '2305', map: 'assets/p3/paths/dusurui.jpg', path: '生成于西北太平洋；7月28日9时55分在福建晋江市沿海登陆。路径：西北太平洋→巴士海峡→南海东北部→福建晋江→江西→安徽→华北→东北。', impact: '七级风圈半径约400公里，十级风圈约120—180公里。影响台湾、福建、浙江、江西、安徽、河南、河北、北京、天津、吉林、黑龙江等地；残余环流诱发华北极端暴雨。', loss: '死亡失踪约107人，紧急转移安置约120万人，直接经济损失约1100亿元（含华北暴雨影响）。福建、京津冀、东北等地洪涝严重，农田、房屋、交通大面积损毁。', media: ['assets/p3/source/news-5.mp4','assets/p3/source/news-14.mp4'], mediaCaption: ['暴雨现场','新闻视频'], ticker: '杜苏芮登陆后与中纬度系统相互作用，华北出现极端暴雨。' }
  };
  var detailTrigger = null;
  var bodyOverflow = '';
  function openTyphoon(key, trigger) {
    var item = typhoonInfo[key];
    if (!item || !detail) return;
    [$('#p3DetailMediaOne'), $('#p3DetailMediaTwo')].forEach(function (video) {
      if (!video) return;
      video.pause();
      video.removeAttribute('src');
      video.load();
    });
    detailTrigger = trigger;
    $('#p3DetailKicker').textContent = item.year + '  台风编号 ' + item.number;
    $('#p3DetailTitle').textContent = '台风“' + item.name + '”';
    $('#p3DetailMap').src = item.map;
    $('#p3DetailMap').alt = item.name + '台风路径图';
    $('#p3DetailPath').textContent = item.path;
    $('#p3DetailImpact').textContent = item.impact;
    $('#p3DetailLoss').textContent = item.loss;
    var media = item.media || ['assets/p3/media/media-flood.jpg', 'assets/p3/media/media-news.jpg'];
    var mediaCaption = item.mediaCaption || ['现场画面', '新闻播报'];
    var mediaOne = $('#p3DetailMediaOne'), mediaTwo = $('#p3DetailMediaTwo');
    var mediaOneCaption = $('#p3DetailMediaOneCaption'), mediaTwoCaption = $('#p3DetailMediaTwoCaption');
    if (mediaOne) {
      mediaOne.src = media[0];
      mediaOne.alt = mediaCaption[0] + '：台风“' + item.name + '”';
      mediaOne.autoplay = true;
      mediaOne.loop = true;
      mediaOne.muted = true;
      mediaOne.playsInline = true;
      mediaOne.load();
      mediaOne.play().catch(function () {});
      mediaOne.addEventListener('canplay', function () { mediaOne.play().catch(function () {}); }, { once: true });
    }
    if (mediaTwo) {
      mediaTwo.src = media[1];
      mediaTwo.alt = mediaCaption[1] + '：台风“' + item.name + '”';
      mediaTwo.autoplay = true;
      mediaTwo.loop = true;
      mediaTwo.muted = true;
      mediaTwo.playsInline = true;
      mediaTwo.load();
      mediaTwo.play().catch(function () {});
      mediaTwo.addEventListener('canplay', function () { mediaTwo.play().catch(function () {}); }, { once: true });
    }
    if (mediaOneCaption) mediaOneCaption.textContent = mediaCaption[0];
    if (mediaTwoCaption) mediaTwoCaption.textContent = mediaCaption[1];
    var ticker = $('#p3DetailTicker');
    if (ticker) ticker.textContent = item.ticker || (item.year + '台风“' + item.name + '”影响沿海地区，请关注预警信息。');
    detail.hidden = false;
    detail.scrollTop = 0;
    if (historyScene) historyScene.inert = true;
    $$('.sec:not(#p3)').forEach(function (section) { section.inert = true; });
    var back = $('.p3-back'); if (back) back.inert = true;
    bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    detailClose.focus();
  }
  function closeTyphoon() {
    if (!detail || detail.hidden) return;
    [$('#p3DetailMediaOne'), $('#p3DetailMediaTwo')].forEach(function (video) {
      if (!video) return;
      video.pause();
      try { video.currentTime = 0; } catch (e) {}
      video.removeAttribute('src');
      video.load();
    });
    detail.hidden = true;
    if (historyScene) historyScene.inert = false;
    $$('.sec:not(#p3)').forEach(function (section) { section.inert = false; });
    var back = $('.p3-back'); if (back) back.inert = false;
    document.body.style.overflow = bodyOverflow;
    if (detailTrigger) detailTrigger.focus();
    detailTrigger = null;
  }
  $$('.p3-year-point').forEach(function (point) {
    point.addEventListener('click', function () { openTyphoon(point.dataset.typhoon, point); });
  });
  if (detailClose) detailClose.addEventListener('click', closeTyphoon);
  if (detail) detail.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); closeTyphoon(); } });

  var route = {
    west: { title: '西行路径', image: 'assets/p3/routes/route-west.webp', copy: '在广东、海南、广西登陆，破坏力大。典型代表：2014年威马逊。' },
    northwest: { title: '西北路径', image: 'assets/p3/routes/route-northwest.webp', copy: '在台湾附近或浙江一带登陆，影响范围广。典型代表：2016年莫兰蒂。' },
    turn: { title: '转向路径', image: 'assets/p3/routes/route-turn.webp', copy: '在我国25N登陆而后转向东北。典型代表：2018年谭美。' }
  };
  function setRoute(key, navigate) {
    var d = route[key] || route.west;
    var title = $('#p3RouteTitle'), image = $('#p3RouteMap'), text = $('#p3RouteCopy');
    if (title) title.textContent = d.title;
    if (image) image.src = d.image;
    if (text) text.textContent = d.copy;
    if (originRouteMap) { originRouteMap.src = d.image; originRouteMap.alt = d.title + '示意图'; }
    if (originRouteCopy) originRouteCopy.textContent = d.copy;
    $$('[data-route]').forEach(function (b) { b.classList.toggle('is-active', b.dataset.route === key); });
    if (navigate !== false) show('route');
  }
  function show(name) {
    // 任意页面切换都使旧的路径动画失效，避免返回后旧回调把页面切回去。
    routeToken++;
    hideFlightLayer();
    if (name !== 'mapgame' && puzzleMode === 'memory') {
      clearInterval(puzzleTimer);
      puzzleTimer = null;
      puzzleMode = 'ready';
      if (puzzleBoard) puzzleBoard.classList.remove('is-memory', 'is-playing');
      if (puzzleCountdown) puzzleCountdown.hidden = true;
      if (puzzleFull) puzzleFull.hidden = false;
      if (puzzleGrid) puzzleGrid.hidden = true;
      if (puzzleStart) puzzleStart.hidden = false;
      if (puzzleStatus) puzzleStatus.textContent = '先观察完整地图，再开始拼图';
    }
    views.forEach(function (v) { v.hidden = v.dataset.view !== name; });
    if (historyScene) {
      historyScene.classList.remove('is-entering');
      if (name === 'history') {
        void historyScene.offsetWidth;
        historyScene.classList.add('is-entering');
      }
    }
    rail.forEach(function (b) { b.classList.toggle('is-active', b.dataset.p3View === name); });
    if (scroll) scroll.scrollTop = 0;
  }
  root.addEventListener('p3-entry-route', function (event) {
    var key = event.detail && event.detail.route;
    var target = { wave: 'origin', map: 'mapgame', tree: 'impact', wall: 'after' }[key];
    if (!target) return;
    if (study) study.hidden = true;
    if (originScene) originScene.hidden = false;
    resetOriginStudy();
    if (key === 'tree') setImpactStep('question');
    show(target);
    if (key === 'wave') enterOriginStudy();
  });
  rail.forEach(function (b) { b.addEventListener('click', function () { if (b.dataset.p3View === 'route') setRoute('west', false); show(b.dataset.p3View); }); });
  $$('[data-route]').forEach(function (b) { b.addEventListener('click', function () { setRoute(b.dataset.route, false); }); });
  $$('[data-next]').forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.next); }); });
  if (processBack) processBack.addEventListener('click', function () {
    show('origin');
    enterOriginStudy();
  });
  if (evidenceBack) evidenceBack.addEventListener('click', function () {
    show('process');
  });
  $$('[data-after-next]').forEach(function (b) { b.addEventListener('click', function () {
    var targetId = b.dataset.afterNext === 'games' ? 'p3AfterGames' : 'p3AfterCards';
    var target = document.getElementById(targetId);
    if (target) target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }); });
  var statsBack = $('#p3StatsBack');
  if (statsBack) statsBack.addEventListener('click', function () {
    show('origin');
    enterOriginStudy();
    if (originRoute) window.setTimeout(function () {
      originRoute.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }, 40);
  });
  var back = $('.p3-back');
  if (back) back.addEventListener('click', function () { glideTo(secs[1].offsetTop); });
  show('origin');
}

/* ============================================================
   ④ 滚动调度
   ============================================================ */
var secs = $$('.sec'), pager = $('#pager');

var gliding = false;
function glideTo(y) {
  if (reduced) { window.scrollTo(0, y); return; }
  gliding = true;
  var y0 = window.scrollY, dy = y - y0, t0 = performance.now();
  var D = Math.min(1100, 460 + Math.abs(dy) * 0.16);
  (function step(now) {
    if (!gliding) return;
    var t = clamp((now - t0) / D, 0, 1);
    window.scrollTo(0, y0 + dy * easeInOut(t));
    if (t < 1) requestAnimationFrame(step); else gliding = false;
  })(performance.now());
}
['wheel', 'touchstart', 'keydown'].forEach(function (ev) {
  window.addEventListener(ev, function () { gliding = false; }, { passive: true });
});
if (cta) cta.addEventListener('click', playSuck);
if (sec2 && 'IntersectionObserver' in window) {
  new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting && e.intersectionRatio > 0.5) startEye(); });
  }, { threshold: [0.5] }).observe(sec2);
} else { setTimeout(startEye, 1200); }

function currentIndex() {
  var mid = window.scrollY + window.innerHeight * 0.5, k = 0;
  for (var i = secs.length - 1; i >= 0; i--) { if (mid >= secs[i].offsetTop) { k = i; break; } }
  return k;
}

function frame() {
  if (pager) pager.textContent = (currentIndex() + 1) + '/' + secs.length;
  requestAnimationFrame(frame);
}

/* ============================================================
   ⑤ 视口高度：把实测的可视高度写进 --vh
   ------------------------------------------------------------
   CSS 里已经有 vh / svh 两级兜底，但都不够，必须再用 JS 兜一道：
   · svh 只有 iOS 15.4+ / Chrome 108+ 才认。安卓微信是 X5 内核（Chromium 77/86 级别），
     部分国产浏览器也不认；一旦不认，.sec{height:100svh} 整条声明作废 →
     三个页面塌成一篇长文档 → 手机上一路滑到底、完全没有翻页感。
   · 就算认 svh，它按"工具栏全部展开时的最小高度"算，比真正看得见的区域矮一截，
     一页装不满一屏，底部会露出下一页的一条边，看着依然不像"一页一页"。
   用实测 innerHeight 覆盖掉它，两个问题一起解决。
   只在数值真的变了才写，避免翻页过程中反复改高度造成抖动。 */
var vhTimer = 0;

function fixViewport() {
  var h = window.innerHeight || 0;
  if (window.visualViewport && visualViewport.height) h = Math.min(h, visualViewport.height);
  if (!h) return;
  var root = document.documentElement;
  if (parseInt(root.style.getPropertyValue('--vh'), 10) === Math.round(h)) return;
  var k = currentIndex();                                   // 先记住当时停在哪一页
  root.style.setProperty('--vh', Math.round(h) + 'px');
  var t = secs[Math.min(k, secs.length - 1)];
  if (t) window.scrollTo(0, Math.round(t.offsetTop));        // 高度变了要重新对齐页边界
}

function queueViewport() {                                  // 地址栏收放会连续触发，去抖
  clearTimeout(vhTimer);
  vhTimer = setTimeout(fixViewport, 140);
}

window.addEventListener('resize', queueViewport, { passive: true });
window.addEventListener('orientationchange', function () { setTimeout(fixViewport, 180); }, { passive: true });
if (window.visualViewport && visualViewport.addEventListener) {
  visualViewport.addEventListener('resize', queueViewport, { passive: true });
}
window.addEventListener('pageshow', fixViewport, { passive: true });

/* ============================================================
   启动
   ============================================================ */
fixViewport();     // 必须最先跑：后面所有 calc(N * var(--u)) 都依赖 --vh
initCover();
initP3();
measureEye();
requestAnimationFrame(frame);

var rzT;
window.addEventListener('resize', function () {
  clearTimeout(rzT);
  rzT = setTimeout(function () { placePerson(); measureEye(); }, 120);
});
window.addEventListener('load', measureEye);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureEye);

})();
