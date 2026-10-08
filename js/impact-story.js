(function () {
  'use strict';
  var scene = document.getElementById('p3ImpactScene');
  if (!scene) return;
  var root = document.getElementById('p3');
  var chain = document.getElementById('p3ImpactChain');
  var trigger = document.getElementById('p3ImpactChainTrigger');
  var statistics = document.querySelector('.p3-impact-statistics');
  var pause = document.getElementById('p3ImpactPause');
  var replay = document.getElementById('p3ImpactReplay');
  var announcement = document.getElementById('p3ImpactAnnouncement');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dialogs = Array.prototype.slice.call(scene.querySelectorAll('[data-impact-dialog]'));
  var people = Array.prototype.slice.call(scene.querySelectorAll('[data-impact-person]'));
  var lines = dialogs.map(function (dialog) {
    var bubble = dialog.querySelector('.p3-impact-bubble');
    var text = bubble.textContent.trim();
    var size = document.createElement('span'), display = document.createElement('span');
    size.className = 'impact-line-size'; size.textContent = text; size.setAttribute('aria-hidden', 'true');
    display.className = 'impact-line-text';
    bubble.textContent = ''; bubble.appendChild(size); bubble.appendChild(display);
    return { key:dialog.dataset.impactDialog, text:text, display:display };
  });
  var typeInterval = 35, linePause = 1500;
  var index = 0, offset = 0, timer = null, deadline = 0, remaining = typeInterval;
  var visible = false, paused = false, finished = false;
  function canRun() { return visible && !paused && !finished && !document.hidden && !scene.closest('[hidden]'); }
  function stopTimer() {
    if (timer === null) return;
    remaining = Math.max(0, deadline - performance.now());
    clearTimeout(timer); timer = null;
  }
  function schedule(delay) {
    remaining = delay;
    if (!canRun()) return;
    deadline = performance.now() + delay;
    timer = setTimeout(function () { timer = null; tick(); }, delay);
  }
  function showLine() {
    var line = lines[index];
    scene.dataset.impactStep = line.key;
    dialogs.forEach(function (dialog) { dialog.hidden = dialog.dataset.impactDialog !== line.key; });
    people.forEach(function (person) { person.hidden = person.dataset.impactPerson !== line.key; });
    line.display.textContent = line.text.slice(0, offset);
  }
  function openChain() {
    chain.hidden = false;
    statistics.hidden = false;
    scene.dataset.chainOpen = 'true';
    trigger.hidden = false;
    trigger.setAttribute('aria-label', '查看下方灾害链');
  }
  function tick() {
    if (!canRun()) return;
    var line = lines[index];
    if (offset < line.text.length) {
      offset = reduced ? line.text.length : offset + 1;
      line.display.textContent = line.text.slice(0, offset);
      if (offset === line.text.length) {
        announcement.textContent = line.text;
        // 完整说完后短暂停留；减少动态时整句显示，保留同等阅读时间。
        schedule(linePause + (reduced ? line.text.length * typeInterval : 0));
      } else schedule(typeInterval);
    } else if (index < lines.length - 1) {
      index++; offset = 0; showLine(); schedule(typeInterval);
    } else {
      finished = true; openChain(); pause.hidden = true;
    }
  }
  function sync() {
    if (!canRun()) stopTimer();
    else if (timer === null) schedule(remaining);
  }
  function reset(step) {
    stopTimer();
    index = Math.max(0, lines.findIndex(function (line) { return line.key === (step || 'question'); }));
    offset = 0; remaining = typeInterval; paused = false; finished = false;
    pause.hidden = false; pause.textContent = '暂停对话'; pause.setAttribute('aria-pressed', 'false');
    announcement.textContent = ''; chain.hidden = true; statistics.hidden = true; trigger.hidden = true;
    scene.dataset.chainOpen = 'false';
    Array.prototype.forEach.call(chain.querySelectorAll('.impact-avatar'), function (button) {
      button.setAttribute('aria-expanded', 'false');
      document.getElementById(button.getAttribute('aria-controls')).hidden = true;
    });
    var content = scene.closest('.chapter-content');
    if (content) content.scrollTop = 0;
    showLine(); sync();
  }
  pause.addEventListener('click', function () {
    paused = !paused;
    pause.setAttribute('aria-pressed', String(paused));
    pause.textContent = paused ? '继续对话' : '暂停对话'; sync();
  });
  replay.addEventListener('click', function () { reset(); });
  Array.prototype.forEach.call(chain.querySelectorAll('.impact-avatar'), function (button) {
    button.addEventListener('click', function () {
      var panel = document.getElementById(button.getAttribute('aria-controls'));
      panel.hidden = !panel.hidden;
      button.setAttribute('aria-expanded', String(!panel.hidden));
    });
  });
  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting && entries[0].intersectionRatio >= .35; sync();
  }, {threshold:[0,.35]}).observe(scene);
  new MutationObserver(sync).observe(root, {subtree:true, attributes:true, attributeFilter:['hidden']});
  var videos = Array.prototype.slice.call(chain.querySelectorAll('video'));
  videos.forEach(function (video) { video.muted = true; video.defaultMuted = true; video.volume = 0; });
  var inView = new Set();
  function syncVideos() {
    videos.forEach(function (video) {
      if (!document.hidden && !video.closest('[hidden]') && inView.has(video)) video.play().catch(function () {});
      else video.pause();
    });
  }
  // Each video has its own visibility so scrolling only plays the footage on screen.
  var videoObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting && entry.intersectionRatio >= .2) inView.add(entry.target);
      else inView.delete(entry.target);
    }); syncVideos();
  }, {threshold:[0,.2]});
  videos.forEach(function (video) { videoObserver.observe(video); });
  new MutationObserver(syncVideos).observe(root, {subtree:true, attributes:true, attributeFilter:['hidden']});
  document.addEventListener('visibilitychange', function () { sync(); syncVideos(); });
  root.addEventListener('p3-return-menu', function () { stopTimer(); videos.forEach(function (video) { video.pause(); }); });
  window.TyphoonImpact = { reset:reset };
  reset();
}());
