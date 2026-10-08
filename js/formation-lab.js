(function () {
  'use strict';
  var lab = document.getElementById('p3FormationLab');
  if (!lab) return;
  var $ = function (s) { return lab.querySelector(s); };
  var buttons = Array.prototype.slice.call(lab.querySelectorAll('[data-condition]'));
  var media = $('#p3FormationVideo'), still = $('#p3FormationStill');
  var progress = $('#p3FormationProgress'), percent = $('#p3FormationPercent');
  var conditionTitle = $('#p3FormationCondition'), explanation = $('#p3FormationExplanation');
  var success = $('#p3FormationSuccess'), workspace = $('.lab-workspace');
  var reveal = document.getElementById('p3OriginReveal');
  var study = document.getElementById('p3OriginStudy');
  var scroller = document.getElementById('p3Scroll'), previousOverflow = '';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var active = new Set(), current = null, achievementShown = false, achievementTimer = null;
  var visible = false, savedInert = [], returnFocus = null;
  var factors = {
    warm: { title:'广阔温暖洋面', text:'海面温度超过26.5℃，暖水层深度大于60米。广阔的温暖洋面持续为台风提供热量，让湿热空气不断上升。' },
    moisture: { title:'充沛水汽', text:'热带暖洋面蒸发旺盛，提供充足水汽。湿空气上升凝结成云，释放潜热，为台风继续发展供能。' },
    disturbance: { title:'初始扰动', text:'一个具有微弱气旋性环流的低压扰动或云团，将周围水汽汇聚起来，让空气开始向中心辐合、上升。' },
    coriolis: { title:'地转偏向力', text:'地球自转使运动中的气流发生偏转，帮助环流旋转起来。赤道附近偏向力太弱，通常难以形成台风。' },
    shear: { title:'低空风切变', text:'台风形成需要较弱的垂直风切变，即高低空风速、风向差异较小。这样云团和上升气流才不易被吹散。' }
  };
  function stop() { media.pause(); }
  function play() {
    if (!current || reduced || !visible || document.hidden) return;
    media.play().catch(function () { lab.classList.remove('is-playing'); });
  }
  function animate(key) {
    current = key;
    stop();
    lab.classList.remove('is-playing');
    still.src = 'assets/formation/' + key + '-poster.webp';
    still.alt = factors[key].title + '形成动画画面';
    media.setAttribute('aria-label', factors[key].title + '形成动画');
    media.src = 'assets/formation/' + key + '.mp4';
    media.load();
    // 点击手势内开始播放，兼容手机浏览器的静音视频策略。
    play();
  }
  media.addEventListener('playing', function () { lab.classList.add('is-playing'); });
  media.addEventListener('error', function () { lab.classList.remove('is-playing'); });
  function closeAchievement(restoreFocus) {
    clearTimeout(achievementTimer);
    if (!success.hidden) scroller.style.overflowY = previousOverflow;
    success.hidden = true;
    workspace.inert = false;
    savedInert.forEach(function (entry) { entry.element.inert = entry.value; });
    savedInert = [];
    if (restoreFocus !== false && returnFocus) returnFocus.focus({ preventScroll:true });
  }
  function openAchievement() {
    if (active.size !== 5 || !visible || study.hidden) return;
    achievementShown = true;
    previousOverflow = scroller.style.overflowY;
    scroller.style.overflowY = 'hidden';
    success.hidden = false;
    workspace.inert = true;
    returnFocus = document.activeElement;
    Array.prototype.forEach.call(document.querySelectorAll('#p3 .chapter-page:not(.chapter-formation), #p3 .chapter-toolbar'), function (element) {
      savedInert.push({element:element,value:element.inert});
      element.inert = true;
    });
    $('#p3FormationSuccessContinue').focus({ preventScroll:true });
  }
  function activate(key) {
    var item = factors[key];
    if (!item) return;
    active.add(key);
    buttons.forEach(function (button) {
      button.setAttribute('aria-pressed', active.has(button.dataset.condition) ? 'true' : 'false');
      button.classList.toggle('is-current', button.dataset.condition === key);
    });
    lab.dataset.energy = String(active.size);
    progress.setAttribute('aria-valuenow', String(active.size * 20));
    percent.textContent = active.size * 20 + '%';
    Array.prototype.forEach.call(progress.children, function (segment, i) { segment.classList.toggle('is-filled', i < active.size); });
    conditionTitle.textContent = item.title;
    explanation.textContent = item.text;
    animate(key);
    if (active.size === 5) {
      reveal.hidden = false;
      $('.lab-continue').hidden = false;
      if (!achievementShown) {
        clearTimeout(achievementTimer);
        achievementTimer = setTimeout(openAchievement, reduced ? 0 : 900);
      }
    }
  }
  function reset() {
    closeAchievement(false);
    stop();
    media.removeAttribute('src');
    media.load();
    lab.classList.remove('is-playing');
    still.src = 'assets/formation/idle.webp';
    still.alt = '平静的温暖洋面';
    active.clear();
    current = null;
    achievementShown = false;
    lab.dataset.energy = '0';
    reveal.hidden = true;
    $('.lab-continue').hidden = true;
    percent.textContent = '0%';
    progress.setAttribute('aria-valuenow','0');
    Array.prototype.forEach.call(progress.children, function (segment) { segment.classList.remove('is-filled'); });
    buttons.forEach(function (button) { button.setAttribute('aria-pressed','false'); button.classList.remove('is-current'); });
    conditionTitle.textContent = '点亮五个能量开关';
    explanation.textContent = '点击周围的开关，观察孕育舱里的变化。每集齐一个条件，形成进度增加20%。';
  }
  buttons.forEach(function (button) { button.addEventListener('click',function () { activate(button.dataset.condition); }); });
  $('#p3FormationReset').addEventListener('click',reset);
  $('#p3FormationSuccessClose').addEventListener('click',function () { closeAchievement(); });
  $('#p3FormationSuccessContinue').addEventListener('click',function () { closeAchievement(false); $('.lab-continue').click(); });
  document.addEventListener('keydown',function (event) {
    if (success.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); closeAchievement(); }
    if (event.key === 'Tab') {
      var first = $('#p3FormationSuccessContinue'), last = $('#p3FormationSuccessClose');
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting && entries[0].intersectionRatio > .25;
    if (visible) {
      play();
      if (active.size === 5 && !achievementShown) openAchievement();
    } else { stop(); closeAchievement(false); }
  }, {threshold:[0,.25]}).observe(lab);
  else visible = true;
  document.addEventListener('visibilitychange',function () { if (document.hidden) stop(); else play(); });
  window.TyphoonFormation = { reset:reset };
}());
