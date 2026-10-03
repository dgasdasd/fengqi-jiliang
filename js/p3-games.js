(function () {
  'use strict';

  var $ = function (s, root) { return (root || document).querySelector(s); };
  var $$ = function (s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); };
  var options = $('#p3GamesOptions');
  var bubble = $('#p3GamesBubble');
  var gameStage = $('#p3GameStage');
  var gameCanvas = $('#p3GameCanvas');
  var gameTitle = $('#p3GameTitle');
  var gameClose = $('#p3GameClose');
  var continueButton = $('.p3-games-continue');
  if (!options || !bubble || !gameStage || !gameCanvas) return;

  var activeStop = null;
  var bubbleStep = 0;
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function pos(el, x, y, h) {
    el.style.left = (x / 320 * 100).toFixed(3) + '%';
    el.style.top = (y / h * 100).toFixed(3) + '%';
  }
  function stopCurrent() {
    if (activeStop) { try { activeStop(); } catch (e) {} }
    activeStop = null;
  }
  function showOptions() {
    stopCurrent();
    gameCanvas.innerHTML = '';
    gameStage.hidden = true;
    options.hidden = false;
    options.classList.remove('is-dim');
  }
  function openGame(type) {
    stopCurrent();
    options.hidden = true;
    gameStage.hidden = false;
    gameCanvas.innerHTML = '';
    gameTitle.textContent = type === 'river' ? '救援：穿过急流' : type === 'medic' ? '医护：完成救治' : '邻里：拉出拖拉机';
    if (type === 'river') startRiver(gameCanvas);
    if (type === 'medic') startMedic(gameCanvas);
    if (type === 'neighbors') startNeighbors(gameCanvas);
    gameStage.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  bubble.addEventListener('click', function () {
    if (bubbleStep === 0) {
      bubbleStep = 1;
      bubble.innerHTML = '基层的力量是不可小觑的，让我们也来帮助受困人群吧<small>点击选择方式 ▾</small>';
      return;
    }
    bubble.disabled = true;
    bubble.classList.add('is-done');
  });
  $$('[data-p3-game]').forEach(function (button) {
    button.addEventListener('click', function () { openGame(button.dataset.p3Game); });
  });
  if (gameClose) gameClose.addEventListener('click', showOptions);
  if (continueButton) continueButton.addEventListener('click', function () {
    var target = document.getElementById('p3AfterCards');
    if (target) target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  });

  function startRiver(box) {
    box.innerHTML =
      '<div class="p3-g-river-sky"></div><div class="p3-g-river-water"></div>' +
      '<div class="p3-g-river-house"><i></i><b></b></div>' +
      '<div class="p3-g-river-raft"><img src="assets/p3/games/皮筏艇.png" alt="救援皮筏"><img src="assets/p3/games/小台.png" alt="小台" class="p3-g-chibi"></div>' +
      '<div class="p3-g-river-hint">按住方向键，划到对岸的小房子</div>' +
      '<div class="p3-g-river-pad"><button data-dir="up">▲</button><button data-dir="left">◀</button><button data-dir="right">▶</button><button data-dir="down">▼</button></div>' +
      '<div class="p3-g-result"><strong>救援成功！</strong><button>↻ 重玩</button></div>';
    var raft = $('.p3-g-river-raft', box), pad = $('.p3-g-river-pad', box), result = $('.p3-g-result', box);
    var dir = { up: 0, down: 0, left: 0, right: 0 }, obstacles = [], spawnAt = 0, raf = 0, last = 0, x = 160, y = 505, over = false;
    function setRaft() { pos(raft, x, y, 600); }
    function spawn() {
      var n = document.createElement('i');
      n.className = 'p3-g-river-ob ' + ['log', 'branch', 'trash'][Math.floor(Math.random() * 3)];
      var ox = 64 + Math.random() * 192;
      pos(n, ox, -28, 600); box.appendChild(n);
      obstacles.push({ el: n, x: ox, y: -28, v: .12 + Math.random() * .08 });
    }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    function finish() { over = true; stop(); result.classList.add('is-on'); }
    function reset() {
      stop(); obstacles.forEach(function (o) { o.el.remove(); }); obstacles = [];
      dir = { up: 0, down: 0, left: 0, right: 0 }; x = 160; y = 505; spawnAt = 0; over = false;
      result.classList.remove('is-on'); setRaft(); last = Date.now(); raf = requestAnimationFrame(loop);
    }
    function loop() {
      if (over) return;
      var now = Date.now(), dt = Math.min(42, now - last), v = dt * .15; last = now;
      if (dir.left) x -= v; if (dir.right) x += v; if (dir.up) y -= v; if (dir.down) y += v;
      x = Math.max(54, Math.min(266, x)); y = Math.max(62, Math.min(515, y));
      spawnAt += dt; if (spawnAt > 560) { spawnAt = 0; spawn(); }
      obstacles.forEach(function (o) {
        o.y += dt * o.v; pos(o.el, o.x, o.y, 600);
        if (!o.hit && Math.abs(o.x - x) < 29 && Math.abs(o.y - y) < 26) { o.hit = true; o.el.classList.add('is-hit'); y += 42; }
      });
      obstacles = obstacles.filter(function (o) { if (o.y > 640) { o.el.remove(); return false; } return true; });
      setRaft(); if (y <= 67) { finish(); return; }
      raf = requestAnimationFrame(loop);
    }
    function nudge(name) {
      // 点击也要有反馈；按住时 loop 继续移动，松开后停止。
      if (name === 'left') x -= 18;
      if (name === 'right') x += 18;
      if (name === 'up') y -= 22;
      if (name === 'down') y += 22;
      x = Math.max(54, Math.min(266, x));
      y = Math.max(62, Math.min(515, y));
      setRaft();
    }
    function press(ev) { ev.preventDefault(); ev.stopPropagation(); var name = ev.currentTarget.dataset.dir; nudge(name); dir[name] = 1; }
    function release(ev) { ev.preventDefault(); ev.stopPropagation(); dir[ev.currentTarget.dataset.dir] = 0; }
    $$('.p3-g-river-pad button', box).forEach(function (b) {
      b.addEventListener('pointerdown', press); b.addEventListener('pointerup', release); b.addEventListener('pointercancel', release); b.addEventListener('pointerleave', release);
    });
    $('button', result).addEventListener('click', function (ev) { ev.stopPropagation(); reset(); });
    activeStop = function () { stop(); $$('.p3-g-river-pad button', box).forEach(function (b) { b.removeEventListener('pointerdown', press); b.removeEventListener('pointerup', release); b.removeEventListener('pointercancel', release); b.removeEventListener('pointerleave', release); }); };
    reset();
  }

  function startMedic(box) {
    box.innerHTML =
      '<div class="p3-g-med-bg"></div><div class="p3-g-med-room"><img class="p3-g-med-nurse" src="assets/p3/games/小台.png" alt="医护助手"><img class="p3-g-med-patient" src="assets/p3/games/病患.png" alt="病患"><span class="p3-g-med-ecg">〰〰〰</span></div>' +
      '<div class="p3-g-med-hint">亮起的节拍点要全部点到，才能把病人救回来</div><div class="p3-g-med-field"></div><div class="p3-g-med-line"></div><div class="p3-g-med-bar"><i></i></div>' +
      '<div class="p3-g-med-lanes"><button data-lane="0">按压</button><button data-lane="1">通气</button><button data-lane="2">除颤</button><button data-lane="3">用药</button></div>' +
      '<div class="p3-g-result"><strong></strong><button>↻ 重玩</button></div>';
    var field = $('.p3-g-med-field', box), line = $('.p3-g-med-line', box), bar = $('.p3-g-med-bar i', box), result = $('.p3-g-result', box), resultText = $('strong', result), lanes = $$('.p3-g-med-lanes button', box);
    var notes = [], left = 12, hits = 0, over = false, raf = 0, last = 0, acc = 0, hitY = 190;
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    function spawn() { var lane = Math.floor(Math.random() * 4), n = document.createElement('i'); n.className = 'p3-g-med-note'; n.dataset.lane = lane; n.style.left = (lane * 25 + 12.5) + '%'; n.style.top = '-10%'; field.appendChild(n); notes.push({ el: n, lane: lane, y: -38 }); }
    function finish(ok) { over = true; stop(); resultText.textContent = ok ? '救治成功！' : '抢救失败，再来一次'; result.classList.toggle('is-bad', !ok); result.classList.add('is-on'); }
    function reset() { stop(); notes.forEach(function (n) { n.el.remove(); }); notes = []; left = 12; hits = 0; over = false; acc = 0; result.classList.remove('is-on', 'is-bad'); bar.style.width = '0%'; spawn(); last = Date.now(); raf = requestAnimationFrame(loop); }
    function loop() {
      if (over) return;
      var now = Date.now(), dt = Math.min(42, now - last); last = now; acc += dt;
      while (left > 0 && notes.length < 1 && acc > 730) { acc = 0; spawn(); }
      var missed = false;
      notes.forEach(function (o) { o.y += dt * .16; o.el.style.top = (o.y / 250 * 100) + '%'; o.el.classList.toggle('near', Math.abs(o.y - hitY) < 58); if (!o.done && o.y > hitY + 62) { o.done = true; missed = true; } });
      notes = notes.filter(function (o) { if (o.done) { o.el.remove(); return false; } return true; });
      if (missed) { finish(false); return; }
      raf = requestAnimationFrame(loop);
    }
    function tap(lane) {
      if (over) return;
      var best = null; notes.forEach(function (o) { if (o.lane === lane && !o.done && Math.abs(o.y - hitY) <= 62 && (!best || Math.abs(o.y - hitY) < Math.abs(best.y - hitY))) best = o; });
      lanes[lane].classList.add('is-flash'); setTimeout(function () { lanes[lane].classList.remove('is-flash'); }, 160);
      if (!best) return;
      best.done = true; best.el.remove(); notes = notes.filter(function (o) { return o !== best; }); hits++; left--; bar.style.width = Math.round(hits / 12 * 100) + '%'; if (hits >= 12) finish(true);
    }
    function clickLane(ev) { ev.preventDefault(); ev.stopPropagation(); tap(Number(ev.currentTarget.dataset.lane)); }
    lanes.forEach(function (b) { b.addEventListener('pointerdown', clickLane); });
    $('button', result).addEventListener('click', function (ev) { ev.stopPropagation(); reset(); });
    activeStop = function () { stop(); lanes.forEach(function (b) { b.removeEventListener('pointerdown', clickLane); }); };
    reset();
  }

  function startNeighbors(box) {
    box.innerHTML =
      '<div class="p3-g-neighbor-mud"></div><img class="p3-g-tractor" src="assets/p3/games/拖拉机.png" alt="陷入泥潭的拖拉机"><div class="p3-g-rope"><i></i></div>' +
      '<div class="p3-g-neighbor-people"><img src="assets/p3/games/村民女.png" alt="村民"><img src="assets/p3/games/村民老.png" alt="村民"><img class="p3-g-chibi" src="assets/p3/games/小台.png" alt="小台"></div>' +
      '<div class="p3-g-neighbor-hint">10 秒内快速向右滑动，把绳子递给村民，一起把拖拉机拉出泥潭</div><div class="p3-g-neighbor-time">10</div><div class="p3-g-neighbor-bar"><i></i></div>' +
      '<div class="p3-g-result"><strong></strong><button>↻ 重玩</button></div>';
    var rope = $('.p3-g-rope', box), head = $('i', rope), tractor = $('.p3-g-tractor', box), time = $('.p3-g-neighbor-time', box), bar = $('.p3-g-neighbor-bar i', box), result = $('.p3-g-result', box), resultText = $('strong', result);
    var prog = 0, left = 10000, over = false, raf = 0, last = 0, lx = 0, lt = 0, power = 0;
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    function paint() { var p = Math.max(0, Math.min(1, prog)); rope.style.width = (10 + p * 58) + '%'; head.style.left = (100 - 5 + p * 58) + '%'; tractor.style.transform = 'translate(' + (p * 10) + '%, ' + (p * 1) + '%) rotate(' + (p * 4) + 'deg)'; bar.style.width = Math.round(p * 100) + '%'; }
    function finish(ok) { over = true; stop(); resultText.textContent = ok ? '拉出来了！' : '时间到，再来一次'; result.classList.toggle('is-bad', !ok); result.classList.add('is-on'); }
    function reset() { stop(); prog = 0; left = 10000; power = 0; over = false; result.classList.remove('is-on', 'is-bad'); time.textContent = '10'; paint(); last = Date.now(); raf = requestAnimationFrame(loop); }
    function loop() { if (over) return; var now = Date.now(), dt = Math.min(50, now - last); last = now; left -= dt; if (left <= 0) { time.textContent = '0'; finish(false); return; } time.textContent = String(Math.ceil(left / 1000)); prog += power * dt * .00042; power *= .88; prog -= dt * .000018; if (prog >= 1) { prog = 1; paint(); finish(true); return; } if (prog < 0) prog = 0; paint(); raf = requestAnimationFrame(loop); }
    function down(ev) { lx = ev.clientX; lt = Date.now(); }
    function move(ev) { if (over) return; var now = Date.now(), dx = ev.clientX - lx, dt = Math.max(8, now - lt); lx = ev.clientX; lt = now; var speed = dx / dt; if (dx <= 2 || speed < .5) return; power = Math.min(3.2, power + speed * .85 - .3); ev.preventDefault(); }
    function onDown(ev) { ev.stopPropagation(); down(ev); }
    function onMove(ev) { ev.stopPropagation(); move(ev); }
    box.addEventListener('pointerdown', onDown); box.addEventListener('pointermove', onMove);
    $('button', result).addEventListener('click', function (ev) { ev.stopPropagation(); reset(); });
    activeStop = function () { stop(); box.removeEventListener('pointerdown', onDown); box.removeEventListener('pointermove', onMove); };
    reset();
  }
}());
