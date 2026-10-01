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
var eyeStarted = false;
function startEye() {
  if (eyeStarted) return;
  eyeStarted = true;
  $$('.suck').forEach(function (el) {
    var t = parseFloat(el.dataset.t || '0.5') * 1000;
    setTimeout(function () { el.classList.add('in'); }, t);
  });
  if (cta) setTimeout(function () { cta.classList.add('show'); },
                     parseFloat(cta.dataset.t || '6') * 1000);
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
   ③ 滚动调度
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

function frame() {
  var vh = window.innerHeight;

  var mid = window.scrollY + vh * 0.5, k = 0;
  for (var i = secs.length - 1; i >= 0; i--) { if (mid >= secs[i].offsetTop) { k = i; break; } }
  if (pager) pager.textContent = (k + 1) + '/' + secs.length;

  requestAnimationFrame(frame);
}

/* ============================================================
   启动
   ============================================================ */
initCover();
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
