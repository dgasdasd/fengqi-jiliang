/* ============================================================
   风起沧海 · 台风科普 H5 —— 渲染引擎（复刻）
   基准画布 320×486，等比缩放到视口
============================================================ */
(function () {
  'use strict';
  // 老浏览器兜底：NodeList.forEach（部分国产浏览器/旧内核没有）
  if (window.NodeList && !NodeList.prototype.forEach) {
    NodeList.prototype.forEach = Array.prototype.forEach;
  }
  var PAGE_W = 320, PAGE_H = 486;
  var PHONE_RATIO = 9 / 19.5;          // 手机竖屏比例（宽 : 高）
  var viewH = PAGE_H;                  // 当前手机画布对应的设计高度
  var pages = window.TESHU_PAGES || [];
  // 主流程页面：P1..P14；P15..P24 弹窗；P25 尾页
  var MAIN = pages.slice(0, 14);
  var POPS = pages.slice(14, 24);
  var ENDP = pages[23] ? [pages[24]] : [];

  var deck, stage, wrap, cur = 0, els = [];
  // 入口流程只允许浏览前三页：封面、播报和四图标导引。
  // 第三页的四个入口由宿主页面接管，继续下滑不再进入原 teshu 的后续页面。
  var ENTRY_LAST = 2;
  var bgm, bgmBtn, audioUnlocked = false;
  var news, p2Page = null, p2Frags = null;   // 正文第一页（灾情播报）的场景与播报音
  var p3Page = null, p3Inner = null, p3StageBox = null, p3Rows = null;   // 正文第二页（风从哪里来）
  var NEWS_LINES = [
    '中央气象台发布台风红色预警', '台风“海葵”中心风力17级', '预计今夜登陆 阵风14级',
    '超强台风级 最大风速62m/s', '台风蓝色预警 沿海风力9级', '风暴潮橙色警报',
    '未来24小时降雨量250毫米', '台风路径向西偏北移动', '近中心最大风力16级',
    '强热带风暴级 登陆在即', '海浪黄色警报 浪高6米', '台风“杜苏芮”二次登陆',
    '局地风力可达13级', '台风外围云系影响华东', '暴雨红色预警 持续强降雨',
    '台风减弱为热带低压', '沿海启动防台风Ⅱ级响应', '未来三天台风雨带北抬'
  ];
  var P2_SCROLL = 1500;                      // 正文第一页的滚动长度（设计单位）

  /* ---------- 工具 ---------- */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  // 解码 HTML 实体（内容里是转义过的）
  function dec(s) {
    return String(s == null ? '' : s)
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  }
  // 所有页面底色都是浅色雾霾图，原来给深色底准备的白色字会看不见 → 换成墨色
  function readableColor(c) {
    var m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(String(c || ''));
    if (!m) return c;
    var lum = 0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3];
    return lum > 225 ? '#1b1a18' : c;
  }
  // 动画编号 → CSS 类（0=无, 1=淡入上移, 4=淡入, 20=缩放, 24/27=打字, customMotion=漂浮）
  function animClass(a) {
    if (!a) return '';
    var t = String(a).split('/')[0];
    switch (t) {
      case '0': return '';
      case '1': return 'a-fadeUp';
      case '3': return 'a-slideL';
      case '4': return 'a-fadeIn';
      case '9': return 'a-zoomIn';
      case '12': return 'a-slideR';
      case '20': return 'a-zoomIn';
      case '23': return 'a-fadeIn';
      case '24': return 'a-typeIn';
      case '27': return 'a-typeIn';
      case 'customMotion': return 'a-float';
      default: return 'a-fadeIn';
    }
  }
  function animDelay(a) {
    if (!a) return 0;
    var p = String(a).split('/');
    var d = parseFloat(p[2]);
    return isNaN(d) ? 0 : d;
  }
  function applyAnim(node, e) {
    var cls = animClass(e.a);
    if (cls) {
      node.classList.add(cls);
      var d = animDelay(e.a);
      if (d > 0) node.style.animationDelay = d + 's';
    }
  }
  function img(src, cls) {
    var n = el('div', 'el el-img ' + (cls || ''));
    var i = document.createElement('img');
    i.src = 'assets/img/' + src;
    i.alt = '';
    i.loading = 'lazy';
    n.appendChild(i);
    return n;
  }
  // 视频占位组件：封面 + 播放按钮
  var VIDEO_SRC = { 3: 'assets/video/typhoon1.mp4', 5: 'assets/video/typhoon2.mp4' };
  function videoNode(e) {
    var n = el('div', 'el el-video');
    var v = document.createElement('video');
    // 懒加载：先只挂封面，点击播放时才注入 src（避免首屏拉取大视频）
    v.dataset.src = VIDEO_SRC[e.page] || '';
    v.poster = 'assets/img/poster-p' + e.page + '.jpg';
    v.preload = 'none';
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.controls = false;
    v.setAttribute('webkit-playsinline', '');
    n.appendChild(v);
    // 播放遮罩
    var mask = el('div', 'video-mask');
    var pb = el('div', 'play-btn');
    mask.appendChild(pb);
    n.appendChild(mask);
    var toggle = function (ev) {
      if (ev) ev.stopPropagation();
      if (v.paused) {
        if (!v.src && v.dataset.src) v.src = v.dataset.src;
        v.controls = true;
        v.play().catch(function () {});
        mask.classList.add('hide');
      } else {
        v.pause();
        mask.classList.remove('hide');
      }
    };
    n.addEventListener('click', toggle);
    v.addEventListener('ended', function () { mask.classList.remove('hide'); v.controls = false; });
    v.addEventListener('pause', function () { if (v.currentTime === 0) mask.classList.remove('hide'); });
    return n;
  }
  function place(node, e) {
    node.style.left = e.x + 'px';
    node.style.top = e.y + 'px';
    if (e.w) node.style.width = e.w + 'px';
    if (e.h) node.style.height = e.h + 'px';
    if (e.z != null) node.style.zIndex = e.z;
    if (e.op != null && e.op !== 1) node.style.opacity = e.op;
    if (e.rot && e.rot !== 'rotateZ(0deg)') node.style.transform = e.rot;
    return node;
  }

  /* ---------- 页面构建 ---------- */
  function buildPage(pg, idx) {
    var page = el('div', 'page page-p' + pg.page);
    page._long = pg.longPage || 0;    // 该页内容的设计高度
    var isLong = (pg.longPage || 0) > PAGE_H;
    if (isLong) {
      var sc = el('div', 'page-scroll');
      var inner = el('div', 'long-inner');
      inner.style.height = Math.max(pg.longPage, PAGE_H) + 'px';
      sc.appendChild(inner);
      page.appendChild(sc);
      page._inner = inner;
      page._scroll = sc;
    } else {
      var inner2 = el('div', 'long-inner');
      inner2.style.height = Math.max(page._long, PAGE_H) + 'px';
      page.appendChild(inner2);
      page._inner = inner2;
    }
    page.dataset.idx = idx;
    page.dataset.page = pg.page;

    // 尾部滚动提示（长页）
    if (isLong) {
      var cue = el('div', 'scroll-cue', '上下滑动查看');
      page.appendChild(cue);
      page._cue = cue;
    }
    (pg.els || []).forEach(function (e) {
      e.page = pg.page;
      var node = null;
      if (e.t === '7') {
        node = el('div', 'el el-text');
        node.innerHTML = dec(e.html || esc(e.txt));
        // 补齐基础排版
        if (e.ic) node.style.color = readableColor(e.ic);
        if (e.align) node.style.textAlign = e.align;
        node.style.lineHeight = (e.h && e.txt) ? 1.5 : 1.5;
      } else if (e.t === '4' || e.t === 'h' || e.t === 'p') {
        node = img(e.src, (e.t === 'p') ? 'cover' : '');
      } else if (e.t === 'o') {
        node = videoNode(e);
      } else {
        return;
      }
      place(node, e);
      applyAnim(node, e);
      page._inner.appendChild(node);
    });
    return page;
  }

  /* ---------- 首页特殊处理：台风水墨 → 雾霾山景 → 人物+大字 ---------- */
  function decorateP1(page) {
    var pg = MAIN[0];
    var inner = page._inner;
    // 三张图层按数据顺序：0=灰色雾霾山景底图，1=人物背影，2=台风水墨图标
    // 挂上 a-* 类，翻页回到首页时会被 go() 统一重新触发
    var roles = ['a-p1bg', 'a-p1person', 'a-p1wind'];
    var imgs = Array.prototype.slice.call(inner.querySelectorAll('.el-img'));
    imgs.forEach(function (n, i) {
      Array.prototype.filter.call(n.classList, function (c) { return c.indexOf('a-') === 0; })
        .forEach(function (c) { n.classList.remove(c); });
      n.style.animation = '';
      n.style.animationDelay = '';
      if (roles[i]) n.classList.add(roles[i]);
    });
    // 山川只用黑色墨迹那版（白纸底已剔除），放大下移到画面中下方
    if (imgs[0]) {
      var bgImg = imgs[0].querySelector('img');
      if (bgImg) bgImg.src = 'assets/img/p1-mountain-black.png';
      imgs[0].style.left = '-40px';
      imgs[0].style.top = '90px';
      imgs[0].style.width = '400px';
      imgs[0].style.height = '533px';
    }
    // 人物背影贴住画面最底部，下面不留空隙
    if (imgs[1]) {
      imgs[1].style.top = 'auto';
      imgs[1].style.bottom = '0px';
    }
    // 台风的水墨图标：沿山脊的高度起笔
    if (imgs[2]) imgs[2].style.top = '178px';
    // 移除原始 6 个文字元素，改用逐字动画
    var chars = [];
    Array.prototype.slice.call(inner.querySelectorAll('.el-text')).forEach(function (n) {
      var t = (n.textContent || '').trim();
      if (t && t.length <= 2) { chars.push({ n: n, t: t }); }
    });
    // 按 x 从左到右排序（原始顺序是打散的）
    chars.sort(function (a, b) {
      return parseFloat(a.n.style.left) - parseFloat(b.n.style.left);
    });
    chars.forEach(function (c, i) {
      var n = c.n;
      var left = parseFloat(n.style.left) || 0;
      var top = parseFloat(n.style.top) || 0;
      var w = parseFloat(n.style.width) || 86;
      var h = parseFloat(n.style.height) || 106;
      n.innerHTML = '';
      n.classList.remove('a-typeIn', 'a-fadeUp', 'a-fadeIn', 'a-zoomIn');
      n.classList.add('p1-char');
      n.style.left = left + 'px';
      n.style.top = (top + 96) + 'px';     // 下移，别太贴顶，且让大字完整落在画面内
      n.style.width = w + 'px';
      n.style.height = h + 'px';
      n.style.display = 'grid';
      n.style.placeItems = 'center';
      n.textContent = c.t;
      //「脊梁」两个字用红色
      if (c.t === '脊' || c.t === '梁') n.classList.add('is-red');
      // 山川出现后与人物背影同时起笔（2.75s），逐字依次落位
      n.style.animation = 'charIn .85s cubic-bezier(.2,1.05,.35,1) ' + (2.75 + i * 0.1) + 's both, charFloat 4.6s ease-in-out ' + (3.8 + i * 0.1) + 's infinite';
    });
    page.classList.add('p1');
  }

  /* ---------- 正文第一页（P2）：台风眼 + 飘落新闻碎片 + 大字 ---------- */
  function decorateP2(page) {
    // 数据驱动的旧内容整体换掉，改造成可滚动的场景页
    page.innerHTML = '';
    var stage = el('div', 'p2-stage');
    stage.appendChild(el('div', 'p2-eye'));
    stage.appendChild(el('div', 'p2-eye-core'));
    // 18 条碎片：两列 × 九行铺满屏幕中段约一半面积
    var layout = [];
    for (var r = 0; r < 9; r++) {
      for (var c = 0; c < 2; c++) {
        layout.push({
          left: c === 0 ? 6 + (r % 3) * 10 : 116 + ((r + 1) % 3) * 12,
          top: 13 + r * 9.2 + (c ? 2.6 : 0)
        });
      }
    }
    p2Frags = [];
    NEWS_LINES.forEach(function (t, i) {
      var f = el('div', 'p2-frag');
      var s = el('i');
      s.textContent = t;
      s.style.animationDuration = (8 + (i % 6) * 1.9).toFixed(1) + 's';
      s.style.animationDelay = (-(i % 9) * 1.4).toFixed(1) + 's';
      f.appendChild(s);
      var pos = layout[i % layout.length];
      f.style.left = pos.left + 'px';
      f.style.top = pos.top + '%';
      stage.appendChild(f);
      p2Frags.push(f);
    });
    // 大字：两行居中（每行四个字，不错行、无逗号）
    var titleWrap = el('div', 'p2-title');
    var titleIn = el('div', 'p2-title-in');
    titleIn.innerHTML = '<span><em>风</em>起沧海</span><span>岁岁设<em>防</em></span>';
    titleWrap.appendChild(titleIn);
    stage.appendChild(titleWrap);
    // 碎片全部吸入后：Q 版人物「小台」飞到台风眼左侧，用对话框讲三句话，讲完飞进漩涡进下一页
    var chara = el('div', 'p2-char');
    var cimg = document.createElement('img');
    // 小人素材：优先用工程里的文件；拷不进来时依次回退到预览服务的 /attach 路由
    var IMG_SRC = [
      'assets/img/小台.png',
      'assets/img/xiaotai.webp',
      '/attach/objects/96/96fb4bb68821fb1a4327c133effe2b89abb24cd0755943019897714706b89763',
      'http://127.0.0.1:8123/attach/objects/96/96fb4bb68821fb1a4327c133effe2b89abb24cd0755943019897714706b89763',
      'file:///C:/Users/21678/.dsh/attachments/v1/objects/96/96fb4bb68821fb1a4327c133effe2b89abb24cd0755943019897714706b89763'
    ];
    var imgIdx = 0;
    cimg.alt = '';
    cimg.onload = function () { chara.classList.add('has-img'); };   // 取到图 → 收起占位文字
    cimg.onerror = function () {
      imgIdx++;
      if (imgIdx < IMG_SRC.length) cimg.src = IMG_SRC[imgIdx];
      else cimg.onerror = null;        // 全部取不到：露出“小台”占位文字
    };
    cimg.src = IMG_SRC[0];
    chara.appendChild(cimg);
    stage.appendChild(chara);
    var dlg = el('div', 'p2-dlg');
    stage.appendChild(dlg);
    var LINES = [
      '你好，我是小台',
      '刚刚扑面而来的新闻蕴藏着风暴的力量与危险。你们是不是很好奇，台风从哪里来？又去往哪里？',
      '和我一起来，看看风雨之下不屈的脊梁吧！'
    ];
    var li = -1, story = false, ending = false;
    function showLine() {
      li++;
      dlg.innerHTML = esc(LINES[li]) + '<span class="p2-dlg-hint">点击继续 ▸</span>';
    }
    dlg.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (ending) return;                            // 防重复触发
      if (li < LINES.length - 1) { showLine(); return; }
      ending = true;
      page._lock = true;                             // 飞走的这段时间不许被滚轮/手势翻页打断
      chara.classList.add('go');                     // 慢慢缩小飞进漩涡消失（不旋转）
      dlg.style.opacity = '0';
      dlg.style.pointerEvents = 'none';
      setTimeout(function () { next(); }, 1500);     // 等飞完再自动进第三页
    });
    page.appendChild(stage);
    // 透明滚动层：只提供滚动距离，滚动进度写进 --p，驱动碎片被吸进台风眼
    var sc = el('div', 'page-scroll');
    var inner = el('div', 'long-inner');
    inner.style.height = P2_SCROLL + 'px';
    sc.appendChild(inner);
    page.appendChild(sc);
    page._inner = inner;
    page._scroll = sc;
    page._long = P2_SCROLL;
    page.style.setProperty('--p', '0');
    sc.addEventListener('scroll', function () {
      var max = sc.scrollHeight - sc.clientHeight;
      var p = max > 0 ? sc.scrollTop / max : 0;
      if (p < 0) p = 0; else if (p > 1) p = 1;
      page.style.setProperty('--p', p.toFixed(3));
      // 全部吸入后 → 小台登场（触发后不再收回）
      if (p > 0.9 && !story) {
        story = true;
        page.classList.add('p2-done');
        showLine();
      }    });
    p2Page = page;
    layoutP2();
  }
  // 每条碎片指向台风眼中心（画面正中）的向量
  function layoutP2() {
    if (!p2Page || !p2Frags) return;
    var cx = PAGE_W / 2, cy = viewH / 2;
    p2Frags.forEach(function (n) {
      var fx = n.offsetLeft + n.offsetWidth / 2;
      var fy = n.offsetTop + n.offsetHeight / 2;
      n.style.setProperty('--tx', Math.round(cx - fx) + 'px');
      n.style.setProperty('--ty', Math.round(cy - fy) + 'px');
    });
  }

  /* ---------- 正文第二页（风从哪里来）：温度计 → 水汽上升视频 → 五条条件 ---------- */
  var P3_COND_IMG = [
    '008-12620ecf0c0262ce81737c96fbe44cab.png',   // 温度计
    '009-c26b31b104851f4308f685dc39c857c8.png',   // 箭头
    '010-0d4d53f19bce243b20b3427f4bd45048.png',   // 云
    '011-an8F3MNRQPZnRbO.png',                    // 水滴
    '012-PSMbX7IDUKd77Ru.png'                     // 风
  ];
  var P3_CONDS = [
    { ico: 0, html: '广阔且温暖的洋面：温度超过<em>26.5摄氏度</em>深度大于60米' },
    { ico: 1, html: '地转偏向力：<em>地球自转形成的偏向力</em>，是让气流旋转起来的关键' },
    { ico: 2, html: '低空风切变：<em>高低空风速差异小</em>' },
    { ico: 3, html: '充沛的水汽供应：热带洋面<em>蒸发旺盛</em>，为台风形成提供充足水汽' },
    { ico: 4, html: '初始扰动：大气中必须存在一个具备<em>微弱气旋性环流的低压扰动或云团</em>，将周围的水汽初步汇聚起来。' }
  ];
  // 台风的三条典型路径（示意图：在中国轮廓图上画红色虚线轨迹）
  var P3_PATHS = [
    {
      name: '西行路径',
      cap: '在广东、海南、广西登陆，破坏力大。典型代表：<em>2014年威马逊</em>',
      d: 'M244 108 C206 138 176 166 146 190 C120 210 96 226 70 238'
    },
    {
      name: '西北路径',
      cap: '在台湾附近、浙江一带登陆，影响范围广。典型代表：<em>2016年莫兰蒂</em>',
      d: 'M252 214 C220 184 188 156 156 132 C130 113 104 100 80 92'
    },
    {
      name: '转向路径',
      cap: '在我国25°N附近登陆，而后转向东北。典型代表：<em>2018年谭美</em>',
      d: 'M86 244 C126 220 164 192 196 160 C216 140 230 116 238 88'
    }
  ];
  function decorateP3(page) {
    page.innerHTML = '';                     // 这一页原有内容全部不要
    var inner = el('div', 'long-inner');
    var sc = el('div', 'page-scroll');
    sc.appendChild(inner);
    page.appendChild(sc);
    page._inner = inner;
    page._scroll = sc;
    page._lock = false;

    var scene = el('div', 'p3-flow');
    scene.appendChild(el('div', 'p3-title2', '风从哪里来'));
    // 温度计 / 水汽上升视频共用的舞台（视频取代温度计的位置）
    var stageBox = el('div', 'p3-stagebox');
    scene.appendChild(stageBox);

    // 温度计（按住往上游，拉到 26.5°）
    var th = el('div', 'p3-thermo');
    th.innerHTML =
      '<div class="p3-unit"><span>°C</span><span>°F</span></div>' +
      '<div class="p3-tube"><i class="p3-fill"></i></div>' +
      '<div class="p3-bulb"><svg viewBox="0 0 40 40"><path d="M20 9c7 0 12 5 12 11 0 5-4 9-9 9-4 0-7-3-7-6 0-3 2-5 5-5 2 0 3 1 3 3"/><path d="M20 31c-7 0-12-5-12-11 0-5 4-9 9-9 4 0 7 3 7 6 0 3-2 5-5 5-2 0-3-1-3-3"/></svg></div>' +
      '<div class="p3-ticks"></div>' +
      '<div class="p3-val">摄氏度：0.0°</div>' +
      '<div class="p3-hint">按住温度计往上拖，看风是怎么形成的</div>';
    stageBox.appendChild(th);
    var fill = th.querySelector('.p3-fill');
    var val = th.querySelector('.p3-val');
    var cur = 0, done = false;

    // 水汽上升视频：温度计消失后在原位循环播放（径向遮罩把背景化开）
    var vid = el('div', 'p3-video');
    var vv = document.createElement('video');
    vv.src = 'assets/img/水汽上升.mp4';
    vv.muted = true;
    vv.loop = true;
    vv.playsInline = true;
    vv.setAttribute('playsinline', '');
    vv.setAttribute('webkit-playsinline', '');
    vv.preload = 'auto';
    vid.appendChild(vv);
    stageBox.appendChild(vid);

    // 五条形成条件：抠图图标 + 纯文字（无底框），先从视频旁出现再飞到位
    var condEls = [];
    P3_CONDS.forEach(function (c) {
      var row = el('div', 'p3-cond2');
      row.innerHTML = '<span class="p3-ico2"><img src="assets/img/' + P3_COND_IMG[c.ico] + '" alt=""></span>' +
        '<span class="p3-txt">' + c.html + '</span>';
      scene.appendChild(row);   // 排在视频下面（层在上：飞下来时浮在视频/图片之上）
      condEls.push(row);
    });

    // 形成过程文本框（右侧滚轮控制上下滚动）
    var panel = el('div', 'p3-panel');
    panel.innerHTML =
      '<div class="p3-panel-h">形成过程</div>' +
      '<div class="p3-panel-body">' +
        '<div class="p3-panel-text">' +
          '<p><b>孕育阶段：</b>热带有大量湿热上升空气形成强对流，在地转偏向力的影响下形成初步云团</p>' +
          '<p><b>发展阶段：</b>低压中心不断吸收水汽，风力增大强度升级为热带风暴、强热带风暴</p>' +
          '<p><b>成熟阶段：</b>中心附近风力高达12级并且有明显形状规整的台风眼</p>' +
          '<p><b>消亡阶段：</b>台风登陆后因摩擦力迅速增大而逐渐消散</p>' +
        '</div>' +
        '<div class="p3-wheel"><i class="p3-wheel-knob"></i></div>' +
      '</div>';
    scene.appendChild(panel);

    // 台风的类型：三个按钮，点一个出现对应路径图 + 说明（在蓝色文本框下面）
    var types = el('div', 'p3-types');
    types.appendChild(el('div', 'p3-types-h', '台风的类型'));
    var tabs = el('div', 'p3-tabs');
    var charts = [];
    P3_PATHS.forEach(function (pt, i) {
      var b = el('div', 'p3-tab' + (i === 0 ? ' on' : ''), pt.name);
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        Array.prototype.forEach.call(tabs.children, function (n, j) {
          if (j === i) n.classList.add('on'); else n.classList.remove('on');
        });
        charts.forEach(function (c, j) { if (j === i) c.classList.add('on'); else c.classList.remove('on'); });
        layoutP3();
        setTimeout(layoutP3, 480);            // 等展开动画结束再量一次高度
      });
      tabs.appendChild(b);
      var c = el('div', 'p3-chart' + (i === 0 ? ' on' : ''));
      c.innerHTML = '<div class="p3-chart-fig">' +
        '<img src="assets/img/地图轮廓.jpg" alt="">' +
        '<svg viewBox="0 0 320 288" preserveAspectRatio="none"><path d="' + pt.d + '"/></svg>' +
        '</div><div class="p3-chart-cap">' + pt.cap + '</div>';
      charts.push(c);
    });
    types.appendChild(tabs);
    charts.forEach(function (c) { types.appendChild(c); });
    scene.appendChild(types);
    scene.appendChild(el('div', 'p3-pad'));
    var boxText = panel.querySelector('.p3-panel-text');
    var knob = panel.querySelector('.p3-wheel-knob');
    var wheel = panel.querySelector('.p3-wheel');
    var wheelDrag = false;
    function syncKnob() {
      var max = boxText.scrollHeight - boxText.clientHeight;
      var p = max > 0 ? boxText.scrollTop / max : 0;
      knob.style.top = (6 + p * 62) + 'px';
    }
    boxText.addEventListener('scroll', syncKnob);
    wheel.addEventListener('pointerdown', function (e) {
      wheelDrag = true;
      if (e.preventDefault) e.preventDefault();
      if (wheel.setPointerCapture && e.pointerId != null) { try { wheel.setPointerCapture(e.pointerId); } catch (err) {} }
      wheelMove(e);
    });
    wheel.addEventListener('pointermove', function (e) { if (wheelDrag) { if (e.preventDefault) e.preventDefault(); wheelMove(e); } });
    wheel.addEventListener('pointerup', function () { wheelDrag = false; });
    wheel.addEventListener('pointercancel', function () { wheelDrag = false; });
    function wheelMove(e) {
      var r = wheel.getBoundingClientRect();
      if (!r.height) return;
      var p = (e.clientY - r.top) / r.height;
      if (p < 0) p = 0; else if (p > 1) p = 1;
      var max = boxText.scrollHeight - boxText.clientHeight;
      boxText.scrollTop = p * max;
      knob.style.top = (6 + p * 62) + 'px';
    }
    inner.appendChild(scene);
    p3Page = page; p3Inner = inner; p3StageBox = stageBox; p3Rows = condEls;

    function setTemp(t) {
      if (t < 0) t = 0;
      if (t > 30) t = 30;
      cur = t;
      fill.style.height = (t / 30 * 164) + 'px';
      val.textContent = '摄氏度：' + t.toFixed(1) + '°';
    }
    function tempAt(e) {
      var r = th.getBoundingClientRect();
      if (!r.height) return cur;
      var y = (e.clientY - r.top) / r.height * 296;      // 换算回设计单位
      setTemp((190 - y) / 170 * 30);                     // 管身 20→190 对应 30°→0°
      return cur;
    }
    function finish() {
      if (done) return;
      done = true;
      setTemp(26.5);
      th.classList.add('gone');
      setTimeout(function () {
        vid.classList.add('go');                          // 温度计原位开始循环播放水汽上升
        try { vv.play(); } catch (e) {}
        // 第 1 条：先在视频旁出现，再飞下去
        condEls[0].classList.add('show');
        setTimeout(function () { condEls[0].classList.add('on'); }, 760);
        // 后 4 条随视频播放逐个出现（先出现在视频旁，再快速下移到位）
        for (var i = 1; i < condEls.length; i++) {
          (function (k) {
            setTimeout(function () { condEls[k].classList.add('show'); }, 2000 + (k - 1) * 1750);
            setTimeout(function () { condEls[k].classList.add('on'); }, 2780 + (k - 1) * 1750);
          })(i);
        }
        setTimeout(function () { panel.classList.add('on'); syncKnob(); }, 2000 + 4 * 1750 + 900);
      }, 420);
    }
    layoutP3();
    var dragging = false;
    th.addEventListener('pointerdown', function (e) {
      if (done) return;
      dragging = true;
      if (e.preventDefault) e.preventDefault();
      if (th.setPointerCapture && e.pointerId != null) { try { th.setPointerCapture(e.pointerId); } catch (err) {} }
      if (tempAt(e) >= 26.5) finish();
    });
    th.addEventListener('pointermove', function (e) {
      if (!dragging || done) return;
      if (e.preventDefault) e.preventDefault();
      if (tempAt(e) >= 26.5) finish();
    });
    th.addEventListener('pointerup', function () {
      dragging = false;
      if (!done && cur >= 26.5) finish();
    });
    th.addEventListener('pointercancel', function () { dragging = false; });
    addBack(page);
    layoutP3();
  }
  function layoutP3() {
    if (!p3Page || !p3Inner) return;
    p3Inner.style.height = 'auto';
    var h = Math.max(p3Inner.offsetHeight || 0, Math.round(viewH));
    p3Inner.style.height = h + 'px';
    p3Page._long = h;
    layoutP3Offsets();
  }
  // 每条条件“从视频旁飞下去”的起始偏移（视频中心 → 该条最终位置）
  function layoutP3Offsets() {
    if (!p3StageBox || !p3Rows || !p3Rows.length) return;
    var bx = p3StageBox.offsetLeft + p3StageBox.offsetWidth / 2;
    var by = p3StageBox.offsetTop + p3StageBox.offsetHeight / 2;
    p3Rows.forEach(function (row) {
      var rx = row.offsetLeft + row.offsetWidth / 2;
      var ry = row.offsetTop + row.offsetHeight / 2;
      row.style.setProperty('--dx', Math.round(bx - rx + 22) + 'px');
      row.style.setProperty('--dy', Math.round(by - ry) + 'px');
    });
  }

  /* ---------- 正文第三页（P4）：三种路径切换 ---------- */
  var P4_PATHS = [
    { name: '西行路径', cap: '在广东、海南、广西登陆，破坏力大。典型代表：2014年威马逊' },
    { name: '西北路径', cap: '在台湾附近、浙江一带登陆，影响范围广。典型代表：2016年莫兰蒂' },
    { name: '转向路径', cap: '在我国25°N附近登陆而后转向东北。典型代表：2018年谭美' }
  ];
  function decorateP4(page) {
    var inner = page._inner;
    var kids = Array.prototype.slice.call(inner.children);
    if (kids.length < 20) return;
    // 原数据：图片 [13][14][15] 依次是西行/西北/转向，说明文字 [6][7][8]
    var imgs = [kids[13], kids[14], kids[15]];
    var oldCaps = [kids[6], kids[7], kids[8]];
    // 标题下移到可见位置
    if (kids[2]) { kids[2].classList.add('p4-h'); kids[2].style.top = '10px'; }
    if (kids[1]) kids[1].style.top = '12px';
    // 下方统计与新增长文整体上移，填掉三个段落原本纵向叠起来占的高度
    var SHIFT = -680;
    [9, 10, 11, 12, 16, 17, 18, 19].forEach(function (i) {
      var n = kids[i];
      if (n) n.style.top = (parseFloat(n.style.top) + SHIFT) + 'px';
    });
    oldCaps.forEach(function (n) { n.style.display = 'none'; });
    imgs.forEach(function (n) { n.style.display = 'none'; });
    // 三个文字框一排
    var btns = [];
    P4_PATHS.forEach(function (p, i) {
      var b = el('div', 'p4-tab', p.name);
      b.style.left = (14 + i * 100) + 'px';
      b.addEventListener('click', function (ev) { ev.stopPropagation(); pick(i); });
      inner.appendChild(b);
      btns.push(b);
    });
    var caption = el('div', 'p4-cap');
    inner.appendChild(caption);
    function pick(sel) {
      imgs.forEach(function (n, i) {
        if (i === sel) {
          var w = parseFloat(n.style.width) || 250;
          n.style.left = Math.round((320 - w) / 2) + 'px';
          n.style.top = '116px';
          n.style.display = '';
        } else {
          n.style.display = 'none';
        }
      });
      caption.textContent = P4_PATHS[sel].cap;
      btns.forEach(function (b, i) { b.classList.toggle('on', i === sel); });
    }
    page._long = 1440;                 // 紧凑后整页高度（长文底部留在 1374）
    if (page._inner) page._inner.style.height = '1440px';
  }

  /* ---------- 正文第四页（P5）：风去过哪里 ---------- */
  var TYPHOONS = [
    { y: '2015年 台风“彩虹”', id: '编号：1522', gen: '菲律宾以东洋面生成，10月4日在广东湛江登陆（强台风级，15级）',
      path: '自东向西横穿南海，正面袭击粤西', wind: '七级风圈半径约300公里', rain: '粤西普降大暴雨，局地特大暴雨',
      prov: '广东、广西、海南', loss: '广东20人死亡，直接经济损失超230亿元', why: '国庆假期登陆粤西，佛山出现龙卷风' },
    { y: '2016年 台风“莫兰蒂”', id: '编号：1614', gen: '关岛附近洋面生成，9月15日在福建厦门登陆（超强台风级，15级）',
      path: '经台湾南部海面直扑闽南', wind: '近中心最大风速50米/秒，七级风圈约350公里', rain: '闽南多地24小时雨量超300毫米',
      prov: '福建、广东、浙江、江西', loss: '福建直接经济损失约86亿元，厦门大面积停水停电', why: '1949年以来登陆闽南最强台风' },
    { y: '2017年 台风“天鸽”', id: '编号：1713', gen: '南海北部生成，8月23日在广东珠海登陆（强台风级，14级）',
      path: '在珠江口附近快速西行', wind: '近中心最大风速45米/秒', rain: '珠三角短时强降雨，风暴潮显著',
      prov: '广东、广西、云南', loss: '澳门8人死亡，直接经济损失约300亿元', why: '重创珠海、澳门，港珠澳大桥经受考验' },
    { y: '2018年 台风“山竹”', id: '编号：1822', gen: '西北太平洋生成，9月16日在广东江门台山登陆（强台风级，14级）',
      path: '穿过菲律宾吕宋岛北部后进入南海', wind: '七级风圈半径约500公里，风圈巨大', rain: '华南沿海大范围暴雨',
      prov: '广东、广西、海南、湖南、贵州', loss: '我国直接经济损失约52亿元', why: '风圈巨大，粤港澳大湾区全面停摆' },
    { y: '2019年 台风“利奇马”', id: '编号：1909', gen: '西北太平洋生成，8月10日在浙江温岭登陆（超强台风级，16级）',
      path: '登陆后一路北上，穿过华东、华北', wind: '近中心最大风速52米/秒', rain: '浙江、山东出现极端降雨，局地超500毫米',
      prov: '浙江、江苏、上海、安徽、山东、辽宁', loss: '70余人死亡失踪，直接经济损失约537亿元',
      why: '临海古城被淹、寿光洪灾，北上致灾范围极广' },
    { y: '2020年 台风“黑格比”', id: '编号：2004', gen: '台湾东南洋面生成，8月4日在浙江乐清登陆（台风级，13级）',
      path: '近海快速增强后正面登陆浙南', wind: '登陆时近中心最大风速38米/秒', rain: '浙南沿海大暴雨',
      prov: '浙江、江苏、上海', loss: '直接经济损失约100亿元', why: '近海爆发增强，登陆前12小时连跳两级' },
    { y: '2021年 台风“烟花”', id: '编号：2106', gen: '西北太平洋生成，7月25日在浙江舟山登陆，26日在平湖二次登陆（台风级）',
      path: '移速缓慢，在华东长时间滞留', wind: '七级风圈半径约300公里', rain: '浙江、上海、江苏持续强降雨，余姚等地内涝',
      prov: '浙江、上海、江苏、安徽', loss: '直接经济损失约300亿元', why: '滞留时间长，远程水汽输送引发河南特大暴雨' },
    { y: '2022年 台风“梅花”', id: '编号：2212', gen: '西北太平洋生成，9月14日浙江舟山登陆，15日上海奉贤二次登陆，16日山东青岛三次登陆、辽宁大连四次登陆',
      path: '沿华东沿海一路北上', wind: '登陆时中心风力12—14级', rain: '华东沿海普降暴雨到大暴雨',
      prov: '浙江、上海、江苏、山东、辽宁', loss: '多地停产停课，直接经济损失数十亿元', why: '罕见四次登陆，横跨四省市' },
    { y: '2023年 台风“杜苏芮”', id: '编号：2305', gen: '菲律宾以东洋面生成，7月28日在福建晋江登陆（强台风级，15级）',
      path: '登陆后深入内陆北上，残余环流影响华北', wind: '近中心最大风速50米/秒', rain: '京津冀出现历史罕见极端暴雨，北京门头沟、房山受灾严重',
      prov: '福建、浙江、江西、北京、河北、黑龙江', loss: '华北多地洪涝，直接经济损失巨大',
      why: '引发“23·7”华北特大暴雨，影响远超一般台风' },
    { y: '2024年 台风“摩羯”', id: '编号：2411', gen: '菲律宾以东洋面生成，9月6日在海南文昌登陆（超强台风级，17级以上），后在广东徐闻二次登陆',
      path: '穿过南海北部，登陆海南、广东后进入北部湾', wind: '近中心最大风速达68米/秒', rain: '海南、粤西、桂南大暴雨到特大暴雨',
      prov: '海南、广东、广西、云南', loss: '海南多地房屋受损、大面积停电', why: '近十年登陆我国最强台风之一' }
  ];
  function decorateP5(page) {
    page.innerHTML = '';
    var inner = el('div', 'long-inner');
    var sc = el('div', 'page-scroll');
    sc.appendChild(inner);
    page.appendChild(sc);
    page._inner = inner;
    page._scroll = sc;

    function add(node) { inner.appendChild(node); return node; }
    add(el('div', 'p5-head', '风去过哪里'));

    // 中国地图（点击后才出现年份流水线）
    var map = el('div', 'p5-map');
    map.innerHTML = '<img src="assets/img/027-1787388197429-e28yj4ks607.jpg" alt="">';
    add(map);
    var tip = add(el('div', 'p5-tip', '点击中国地图，看近十年台风都去了哪里'));

    // 年份流水线
    var line = add(el('div', 'p5-line'));
    line.appendChild(el('div', 'p5-rail'));
    var chips = [];
    TYPHOONS.forEach(function (t, i) {
      var left = (i % 2 === 0) ? 12 : 176;
      var top = i * 62;
      var b = el('div', 'p5-year', t.y + '<span>' + t.id + '</span>');
      b.style.left = left + 'px';
      b.style.top = top + 'px';
      b.addEventListener('click', function (ev) { ev.stopPropagation(); pick(i); });
      line.appendChild(b);
      var dot = el('div', 'p5-dot');
      dot.style.top = (top + 14) + 'px';
      line.appendChild(dot);
      chips.push(b);
    });

    // 卡片
    var card = add(el('div', 'p5-card'));
    function pick(sel) {
      var t = TYPHOONS[sel];
      card.innerHTML =
        '<h4>' + esc(t.y) + '　' + esc(t.id) + '</h4>' +
        '<p><b>生成：</b>' + esc(t.gen) + '</p>' +
        '<p><b>经过：</b>' + esc(t.path) + '</p>' +
        '<p><b>风圈：</b>' + esc(t.wind) + '</p>' +
        '<p><b>雨带：</b>' + esc(t.rain) + '</p>' +
        '<p><b>影响省份：</b>' + esc(t.prov) + '</p>' +
        '<p><b>伤亡损失：</b>' + esc(t.loss) + '</p>' +
        '<p><b>为什么被记住：</b>' + esc(t.why) + '</p>';
      card.classList.add('on');
      chips.forEach(function (b, i) { b.classList.toggle('on', i === sel); });
      var top = card.offsetTop - 60;
      if (top < 0) top = 0;
      sc.scrollTop = top;
    }
    map.addEventListener('click', function () {
      line.classList.add('on');
      tip.textContent = '点击年份，查看这一年的台风档案';
    });

    // 两张图表 + 配文
    var c1 = add(el('div', 'p5-chart'));
    c1.style.top = '1220px';
    c1.innerHTML = '<img src="assets/img/034-1787376085019-k77xydek35j.gif" alt="">' +
      '<p>台风灾害损失不仅取决于风力和风速，更取决于影响路径、影响范围、下垫面社会经济暴露度以及是否诱发次生灾害。</p>';
    var c2 = add(el('div', 'p5-chart'));
    c2.style.top = '1600px';
    c2.innerHTML = '<img src="assets/img/035-1787378746477-q8czdumv2r.gif" alt="">' +
      '<p>高强度台风如果避开经济核心区，其绝对损失未必最高。台风环流与中纬度系统相互作用形成的“台风+暴雨+洪涝”复合灾害，影响范围横跨东南沿海至华北、东北，远超一般台风。</p>';

    page._long = 1980;
    inner.style.height = '1980px';
    addBack(page);
  }

  /* ---------- 正文第五页（P6）：风带来了什么（河流上中下游） ---------- */
  var P6_SECS = [
    { tag: '上游', img: 'assets/img/p6-river-up.gif', top: 0,
      note: '<b>强风、巨浪，摧毁船只</b>　风暴潮抬升海平面<br><em>2019年利奇马</em>：七级风圈，近海掀起 8—12 米巨浪，摧毁船只 1699 艘、沉船 263 艘' },
    { tag: '中游 · 城市', img: 'assets/img/p6-river-city.gif', top: 480,
      note: '<b>狂风刮倒树木，高空坠物</b>　强降雨使城内积水，河道上升，道路中断，停水停电<br><em>2023年杜苏芮</em>：倒伏树木 11632 棵，积水路段 383 处，50 万户停电，550 余户停水' },
    { tag: '中游 · 乡村', img: 'assets/img/p6-river-village.gif', top: 960,
      note: '<b>狂风使房屋倒塌，农作物损毁</b>　暴雨使山体滑坡，田间冲垮，河道坍塌，村中与外界失联<br><em>2019年利奇马</em>：冲毁农村房屋 3.6 万间，18.5 万公顷农作物受损，326 处山体滑坡掩埋房屋' },
    { tag: '下游', img: 'assets/img/p6-river-down.gif', top: 1440,
      note: '<b>人员伤亡、房屋受损</b>　停课停产停电，城市内涝，疫病频发<br><em>2026年巴威</em>：江苏、山东地区城市内涝、停电，企业停工、学校停课' }
  ];
  function decorateP6(page) {
    page.innerHTML = '';
    var inner = el('div', 'long-inner');
    var sc = el('div', 'page-scroll');
    sc.appendChild(inner);
    page.appendChild(sc);
    page._inner = inner;
    page._scroll = sc;

    inner.appendChild(el('div', 'p6-head', '风带来了什么'));
    var icon = el('div', 'p6-icon');
    icon.innerHTML =
      '<svg viewBox="0 0 100 100"><g class="swirl">' +
      '<path d="M50 14c20 0 34 14 34 32 0 15-11 26-25 26-11 0-19-8-19-17 0-8 6-14 13-14 6 0 10 4 10 9"/>' +
      '<path d="M50 86C30 86 16 72 16 54c0-15 11-26 25-26 11 0 19 8 19 17 0 8-6 14-13 14-6 0-10-4-10-9"/>' +
      '</g></svg>';
    inner.appendChild(icon);
    inner.appendChild(el('div', 'p6-hint', '点击台风图标，顺流看它带来了什么'));

    var river = el('div', 'p6-river');
    P6_SECS.forEach(function (s) {
      var sec = el('div', 'p6-sec');
      sec.style.top = s.top + 'px';
      sec.innerHTML = '<div class="p6-tag">' + esc(s.tag) + '</div>' +
        '<img src="' + s.img + '" alt="">' +
        '<div class="p6-note">' + s.note + '</div>';
      river.appendChild(sec);
    });
    inner.appendChild(river);
    icon.addEventListener('click', function (ev) {
      ev.stopPropagation();
      river.classList.add('on');
      inner.querySelector('.p6-hint').textContent = '往下滑动，顺流而下';
      sc.scrollTop = 320;
    });

    page._long = 2260;
    inner.style.height = '2260px';
    addBack(page);
  }

  /* ---------- 目录页：四个图标进入不同章节 ---------- */
  var MENU_ICONS = {
    wave: '<svg viewBox="0 0 120 92"><defs><linearGradient id="mwv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd8f5"/><stop offset="1" stop-color="#2f6fb5"/></linearGradient></defs>' +
      '<path d="M6 78c12-40 34-56 58-48 18 6 26 24 16 36-8 10-24 8-27-3-3-10 8-18 21-16 18 3 30 18 36 40z" fill="url(#mwv)"/>' +
      '<path d="M16 62c12-24 30-34 46-28" fill="none" stroke="#eaf7ff" stroke-width="4" stroke-linecap="round" opacity=".85"/></svg>',
    map: '<svg viewBox="0 0 120 92"><path d="M18 32 34 16l22 4 16-8 18 10-6 16 8 14-14 12-6 18-16-6-14 8-12-14-14-6 4-16z" fill="none" stroke="#c0392b" stroke-width="3.4" stroke-linejoin="round"/>' +
      '<g fill="#e0b33a"><path d="M40 34l2.4 5 5.5.6-4 3.8 1.1 5.4-5-2.7-5 2.7 1.1-5.4-4-3.8 5.5-.6z"/>' +
      '<path d="M60 50l1.8 3.6 4 .5-2.9 2.8.8 4-3.7-2-3.7 2 .8-4-2.9-2.8 4-.5z"/></g>' +
      '<path d="M84 70l5 6" stroke="#c0392b" stroke-width="3.4" stroke-linecap="round"/></svg>',
    tree: '<svg viewBox="0 0 120 100"><path d="M56 96V50" stroke="#7a5230" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M56 62l-14-8M56 70l16-9" stroke="#7a5230" stroke-width="5" stroke-linecap="round"/>' +
      '<ellipse cx="36" cy="36" rx="26" ry="18" fill="#2f8f5b"/><ellipse cx="76" cy="30" rx="24" ry="16" fill="#3aa76a"/>' +
      '<ellipse cx="58" cy="20" rx="20" ry="13" fill="#48bd7a"/></svg>',
    wall: '<svg viewBox="0 0 130 80"><g fill="#d8a72a"><path d="M4 54h122v14H4z"/>' +
      '<path d="M4 46h10v8H4zM20 46h10v8H20zM36 46h10v8H36zM52 46h10v8H52zM68 46h10v8H68zM84 46h10v8H84zM100 46h10v8h-10zM116 46h10v8h-10z"/>' +
      '<path d="M44 20h34v26H44z"/><path d="M44 13h6v7h-6zM56 13h6v7h-6zM68 13h6v7h-6z"/><path d="M8 68h114v6H8z"/></g></svg>'
  };
  // 四个真实图标（海浪 / 地图轮廓 / 树木 / 长城）；取不到时退回矢量图标
  var MENU_IMG = {
    wave: ['assets/img/海浪.png', 'objects/0e/0e2f5c1f52e9d63c3d5a7f742b12d3a45dd919abbdab51880f819d68e0d5c9bf'],
    map: ['assets/img/地图轮廓.jpg', 'objects/fc/fc31f9484fa281f4cbe616e6f1cdc38d721fe862ad6fa1da90d0b2f6641f72c4'],
    tree: ['assets/img/树木.png', 'objects/be/bede01d9ca498f8cabbe97f9e4c261173cbc0abd4c57e4429e64879992bac060'],
    wall: ['assets/img/长城.png', 'objects/e5/e58f7d2874ff279b190f156ab8f904ad5103c7fbba9532ba4cbbb8a8ea7cc57d']
  };
  var ATTACH_BASE = '/attach/';
  var ATTACH_FILE = 'file:///C:/Users/21678/.dsh/attachments/v1/';
  // 图片回退链：工程文件 → 预览服务 /attach → 本地附件路径 → 矢量兜底
  function chainImg(holder, key, svgFallback) {
    var pair = MENU_IMG[key] || [];
    var list = [pair[0]];
    if (pair[1]) {
      list.push(ATTACH_BASE + pair[1]);
      list.push('http://127.0.0.1:8123' + ATTACH_BASE + pair[1]);
      list.push(ATTACH_FILE + pair[1]);
    }
    var im = document.createElement('img');
    im.alt = '';
    var i = 0;
    im.onerror = function () {
      i++;
      if (i < list.length) { im.src = list[i]; return; }
      im.onerror = null;
      holder.innerHTML = svgFallback || '';            // 全失败 → 矢量图标
    };
    im.src = list[0];
    holder.appendChild(im);
    return holder;
  }
  function buildMenuPage(wallTarget) {
    var page = el('div', 'page page-menu');
    var inner = el('div', 'long-inner');
    page.appendChild(inner);
    var wrap = el('div', 'menu-wrap');
    // 台风氛围：缓转的漩涡 + 三层淅沥雨丝 + 云
    var bg = el('div', 'menu-bg');
    bg.innerHTML = '<div class="menu-vortex"></div>' +
      '<div class="menu-rain"><i class="rd a"></i><i class="rd b"></i><i class="streak"></i></div>' +
      '<div class="menu-cloud c1"></div><div class="menu-cloud c2"></div>' +
      '<div class="menu-compass"><svg viewBox="0 0 40 40">' +
      '<circle cx="20" cy="20" r="17" fill="none" stroke="rgba(46,89,143,.35)" stroke-width="1"/>' +
      '<circle cx="20" cy="20" r="11" fill="none" stroke="rgba(46,89,143,.25)" stroke-width="1"/>' +
      '<path d="M20 4v6M20 30v6M4 20h6M30 20h6" stroke="rgba(46,89,143,.4)" stroke-width="1.2"/>' +
      '<path d="M20 12l3 8-3-2-3 2z" fill="rgba(46,89,143,.55)"/>' +
      '</svg></div>';
    wrap.appendChild(bg);
    wrap.appendChild(el('div', 'menu-title', '风栖过的<em>脊梁</em>'));
    wrap.appendChild(el('div', 'menu-title-line'));
    wrap.appendChild(el('div', 'menu-sub', '顺着风走一遍 · 从它怎么来，到它去了哪'));

    // 四张卡的几何（设计单位：纵向拉开间隔并整体下移）
    var CW = 140, CH = 146;
    var cards = [
      { to: 3, key: 'wave', num: '01', cap: '风从哪里来', sub: '台风的形成', left: 6, top: 118 },
      { to: 5, key: 'map', num: '02', cap: '风去过哪里', sub: '近十年台风路径', left: 174, top: 236 },
      { to: 6, key: 'tree', num: '03', cap: '风带来了什么', sub: '灾害与影响', left: 6, top: 354 },
      { to: (wallTarget == null ? 9 : wallTarget), key: 'wall', num: '04', cap: '风停止后', sub: '风雨中的脊梁', left: 174, top: 472 }
    ];
    // 相邻卡之间的虚线（同一组数据既画线也用来让台风图标沿线移动）
    var CTRL = [[190, 208], [158, 366], [190, 444]];
    var centers = cards.map(function (c) {
      return { x: c.left + CW / 2, y: c.top + CH / 2 };
    });
    var path = el('div', 'menu-path');
    path.innerHTML = '<svg viewBox="0 0 320 693">' +
      CTRL.map(function (c, i) {
        var a = centers[i], b = centers[i + 1];
        return '<path d="M' + a.x + ' ' + a.y + ' Q' + c[0] + ' ' + c[1] + ' ' + b.x + ' ' + b.y + '"/>';
      }).join('') + '</svg>';
    wrap.appendChild(path);
    // 沿虚线移动的台风图标（用你给的龙卷风图案）
    var typh = el('div', 'menu-typh');
    var timg = document.createElement('img');
    timg.alt = '';
    timg.src = 'assets/img/012-PSMbX7IDUKd77Ru.png';
    typh.appendChild(timg);
    wrap.appendChild(typh);

    var busy = false;
    function travelTo(idx) {
      if (busy) return;
      if (idx === 0) {
        // 第一个入口也交给宿主页面，保持四个图标的跳转规则一致。
        if (window.parent !== window && window.parent.postMessage) {
          window.parent.postMessage({ type: 'teshu-route', route: cards[0].key }, '*');
        } else {
          go(cards[0].to);
        }
        return;
      }
      busy = true;
      var a = centers[idx - 1], b = centers[idx];
      var cx = CTRL[idx - 1][0], cy = CTRL[idx - 1][1];
      var t0 = Date.now(), dur = 900;
      // 显示前先定位起点，避免重播时短暂出现在上一次的终点。
      typh.style.left = a.x + 'px';
      typh.style.top = a.y + 'px';
      typh.style.transform = 'translate(-50%,-50%) scale(.94)';
      typh.classList.add('on');
      function frame() {
        // 动画中返回上一页时取消跳转，不让旧回调突然打开内容页。
        if (!page.classList.contains('on')) {
          typh.classList.remove('on');
          busy = false;
          return;
        }
        var p = (Date.now() - t0) / dur;
        if (p > 1) p = 1;
        var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;   // easeInOutQuad
        var x = (1 - e) * (1 - e) * a.x + 2 * (1 - e) * e * cx + e * e * b.x;
        var y = (1 - e) * (1 - e) * a.y + 2 * (1 - e) * e * cy + e * e * b.y;
        typh.style.left = x + 'px';
        typh.style.top = y + 'px';
        typh.style.transform = 'translate(-50%,-50%) scale(' +
          (0.94 + 0.16 * Math.sin(Math.PI * p)).toFixed(3) + ')';
        if (p < 1) { requestAnimationFrame(frame); return; }
        typh.classList.remove('on');                 // 刮到目标图标后消失
        busy = false;
        // 导引页已完成沿线动画，宿主直接打开对应内容，不再播放第二个台风。
        if (window.parent !== window && window.parent.postMessage) {
          window.parent.postMessage({ type: 'teshu-route', route: cards[idx].key }, '*');
        } else {
          go(cards[idx].to);
        }
      }
      requestAnimationFrame(frame);
    }

    cards.forEach(function (it, idx) {
      var b = el('div', 'menu-item');
      b.style.left = it.left + 'px';
      b.style.top = it.top + 'px';
      b.style.width = CW + 'px';
      b.style.height = CH + 'px';
      b.innerHTML = '<span class="menu-num">' + it.num + '</span>' +
        '<span class="menu-ico"></span>' +
        '<span class="menu-cap">' + it.cap + '</span>' +
        '<span class="menu-sub2">' + it.sub + '</span>';
      chainImg(b.querySelector('.menu-ico'), it.key, MENU_ICONS[it.key]);
      b.addEventListener('click', function (ev) { ev.stopPropagation(); travelTo(idx); });
      wrap.appendChild(b);
    });
    wrap.appendChild(el('div', 'menu-hint', '点击图标，开始这一段风雨之旅'));
    inner.appendChild(wrap);
    page._inner = inner;
    page._long = 0;
    return page;
  }
  // 各章节页面左上角的「返回」→ 回到目录页
  function addBack(page) {
    var b = el('div', 'page-back', '‹ 返回');
    b.addEventListener('click', function (ev) { ev.stopPropagation(); go(2); });
    page.appendChild(b);
    return b;
  }

  /* ============================================================
     全新页「风停之后」：小台登场 + 救援/医护/邻里三个小游戏入口
  ============================================================ */
  function buildAfterPage() {
    var page = el('div', 'page page-after');
    var inner = el('div', 'long-inner');
    var sc = el('div', 'page-scroll');
    sc.appendChild(inner);
    page.appendChild(sc);
    page._inner = inner;
    page._scroll = sc;
    page._long = 0;

    var head = el('div', 'after-head');
    head.appendChild(el('div', 'after-title', '风停之后'));
    head.appendChild(el('div', 'after-sub', '风雨过后，是彼此伸出的手'));
    inner.appendChild(head);

    var stage = el('div', 'after-stage');
    var ch = el('div', 'after-char');
    var cimg = document.createElement('img');
    cimg.alt = '';
    cimg.src = 'assets/img/小台.png';
    ch.appendChild(cimg);
    stage.appendChild(ch);
    var dlg = el('div', 'after-dlg');
    stage.appendChild(dlg);
    inner.appendChild(stage);
    var LINES = ['守望相助，共筑长城', '基层的力量是不可小觑的，我们也来帮助受困人群吧'];
    var li = 0;
    function showHint(txt) {
      dlg.innerHTML = esc(LINES[li]) + '<span class="after-dlg-hint">' + txt + '</span>';
    }
    showHint('点击继续 ▸');
    dlg.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (li < LINES.length - 1) { li++; showHint('点击继续 ▸'); return; }
      showHint('选下面的方式加入 ▾');
    });

    var opts = el('div', 'after-opts');
    ['救援', '医护', '邻里'].forEach(function (name, i) {
      if (i) opts.appendChild(el('span', 'after-sep', '｜'));
      var o = el('div', 'after-opt', name);
      o.addEventListener('click', function (ev) { ev.stopPropagation(); openGame(page, i); });
      opts.appendChild(o);
    });
    inner.appendChild(opts);

    var g = el('div', 'after-game');
    inner.appendChild(g);
    page._game = g;
    page._opts = opts;
    return page;
  }
  // 白底抠图：从四边洪水填充，只清掉与边缘相连的近白像素（保留人物/艇身上的白色部分）
  function cutOut(img) {
    try {
      var w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h || w * h > 9000000) return false;
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      var ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      var d = ctx.getImageData(0, 0, w, h);
      var p = d.data;
      function near(i) {
        var r = p[i], g = p[i + 1], b = p[i + 2];
        return r > 198 && g > 198 && b > 198 &&
          Math.abs(r - g) < 36 && Math.abs(g - b) < 36;
      }
      var stack = [];
      function push(x, y) {
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        var i = (y * w + x) * 4;
        if (p[i + 3] === 0 || !near(i)) return;
        p[i + 3] = 0;
        stack.push(x, y);
      }
      var x, y;
      for (x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
      for (y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
      var guard = 0;
      while (stack.length && guard < 8000000) {
        guard++;
        y = stack.pop(); x = stack.pop();
        push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
      }
      ctx.putImageData(d, 0, 0);
      var url = c.toDataURL('image/png');      // 跨域/tainted 会抛错 → 由外层 catch 兜住
      img.src = url;
      img.classList.add('cut');                // 抠成功：切回正常混合
      return true;
    } catch (e) { return false; }
  }
  function openGame(page, i) {
    var g = page._game;
    if (g._stop) { try { g._stop(); } catch (e) {} g._stop = null; }   // 干掉上一个游戏的循环
    g.innerHTML = '';
    g.classList.add('on');
    page._opts.classList.add('dim');
    setArrows(true);
    if (i === 0) startRiver(g);
    else if (i === 1) startMedic(g);
    else startBoli(g);
    // 素材多路径回退：工程内文件 → /attach → 本机绝对地址 → 本地附件路径
    var IMG_NAMES = {
      '800286d3f1a84b38044b5377a4759f36dc03303bc09aa747d5b94a5a94c3ce13': '皮筏艇.png',
      '497e0f1f6e2f09b8733a545bd80805654a73f92148d83eebf98072976b270fed': '病患.png',
      'f196c6608473831fa0e5696f58777d8ef7f8b8d062c3e0fbfcd5e3fb6274818a': '拖拉机.png',
      'c343ccdf981546b7b1c6c964698d5ba5522633cf78dd0c80cbe8ecbe927ce7f2': '村民女.png',
      '150d49ec318db9b392e5e5eaa1aa0753843fe3257c106def16aeacba78bd1066': '村民男.png',
      '13f60698f4371973740a82e0768eb37356e5a384eb48e5cb527538722b730d97': '泥地.png'
    };
    Array.prototype.forEach.call(g.querySelectorAll('img'), function (im) {
      var src = im.getAttribute('src') || '';
      var m = /\/attach\/objects\/(.+)$/.exec(src);
      var hash = m ? m[1] : null;
      var nm = hash ? IMG_NAMES[hash] : null;
      if (!nm && src.indexOf('assets/img/') === 0) {          // 直接写工程路径的，也接上回退与抠图
        var base = src.replace('assets/img/', '');
        for (var key in IMG_NAMES) {
          if (IMG_NAMES[key] === base) { hash = key; nm = IMG_NAMES[key]; break; }
        }
      }
      if (!nm) return;                                        // 小台等自带透明底的图不动
      var isMud = im.className.indexOf('bl-mudImg') >= 0;
      var list = [];
      list.push('/attach/objects/' + hash);                  // 附件原图优先（webp 带透明通道，本来就没白底）
      list.push('assets/img/' + nm);
      if (nm === '村民男.png') list.push('assets/img/村民老.png');   // 两种命名都试
      list.push('http://127.0.0.1:8123/attach/objects/' + hash);
      list.push('file:///C:/Users/21678/.dsh/attachments/v1/objects/' + hash);
      var k = 0;
      function doCut() {
        if (isMud || im.getAttribute('data-cut')) return;   // 泥地不抠；同一张只抠一次
        if (!im.naturalWidth) { setTimeout(doCut, 130); return; }   // 还没解码好，等一会儿再抠
        if (cutOut(im)) im.setAttribute('data-cut', '1');
      }
      im.onload = doCut;
      im.onerror = function () {
        k++;
        if (k < list.length) { im.src = list[k]; return; }
        im.onerror = null;
        im.style.display = 'none';                 // 全都取不到就收起来，不留破图方块
      };
      im.src = list[0];
      if (im.complete && im.naturalWidth) doCut();  // 已在缓存里、onload 不会再触发
    });
    var close = el('div', 'after-close', '‹ 返回');
    close.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (g._stop) { try { g._stop(); } catch (e) {} g._stop = null; }
      g.classList.remove('on');
      page._opts.classList.remove('dim');
      setArrows(false);
      g.innerHTML = '';
    });
    g.appendChild(close);
  }
  // 游戏进行时藏掉翻页箭头，避免误触
  function setArrows(hide) {
    var list = document.querySelectorAll('.arrow');
    Array.prototype.forEach.call(list, function (a) {
      if (hide) a.style.visibility = 'hidden'; else a.style.visibility = '';
    });
  }

  /* ---------- 小游戏一：过河救援 ---------- */
  function startRiver(box) {
    box.innerHTML =
      '<div class="rv-sky"></div><div class="rv-river"></div>' +
      '<div class="rv-house"><u></u><em></em><b></b><i></i></div>' +
      '<div class="rv-raft">' +
        '<img class="rv-boat" src="/attach/objects/80/800286d3f1a84b38044b5377a4759f36dc03303bc09aa747d5b94a5a94c3ce13" alt="">' +
        '<img class="rv-chibi" src="assets/img/小台.png" alt="">' +
      '</div>' +
      '<div class="rv-hint">按住方向键，划到对岸的小房子</div>' +
      '<div class="rv-pad">' +
        '<b data-d="up">▲</b><b data-d="left">◀</b><b data-d="right">▶</b><b data-d="down">▼</b>' +
      '</div>' +
      '<div class="rv-win"><span>救援成功！</span><b class="rv-replay">↻ 重玩</b></div>';
    var raft = box.querySelector('.rv-raft');
    var pad = box.querySelector('.rv-pad');
    var winBox = box.querySelector('.rv-win');
    var replay = box.querySelector('.rv-replay');
    var dir = { up: 0, down: 0, left: 0, right: 0 };
    var x = 160, y = 560, obs = [], spawnT = 0, last = 0, raf = 0, over = false;

    function spawn() {
      var kinds = ['log', 'branch', 'trash'];
      var k = kinds[Math.floor(Math.random() * kinds.length)];
      var n = el('div', 'rv-ob ' + k);
      var ox = 66 + Math.random() * 188;
      n.style.left = ox + 'px';
      n.style.top = '-30px';
      box.appendChild(n);
      obs.push({ n: n, x: ox, y: -30, v: 0.13 + Math.random() * 0.1 });
    }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    function reset() {
      stop();
      obs.forEach(function (o) { o.n.remove(); });
      obs = []; spawnT = 0; over = false; x = 160; y = 560;
      dir = { up: 0, down: 0, left: 0, right: 0 };
      winBox.classList.remove('on');
      raft.style.left = x + 'px';
      raft.style.top = y + 'px';
      last = Date.now();
      raf = requestAnimationFrame(loop);
    }
    function finish() {
      over = true;
      stop();
      winBox.classList.add('on');            // 胜利后画面静止
    }
    function loop() {
      if (over) return;
      var now = Date.now();
      var dt = Math.min(42, now - last);
      last = now;
      var v = dt * 0.15;
      if (dir.left) x -= v;
      if (dir.right) x += v;
      if (dir.up) y -= v;
      if (dir.down) y += v;
      if (x < 66) x = 66;
      if (x > 254) x = 254;
      if (y < 96) y = 96;
      if (y > 596) y = 596;
      spawnT += dt;
      if (spawnT > 560) { spawnT = 0; spawn(); }
      obs.forEach(function (o) {
        o.y += dt * o.v;
        o.n.style.top = o.y + 'px';
        o.n.style.transform = 'translateX(-50%) rotate(' + (o.y * 0.4).toFixed(1) + 'deg)';
        if (!o.done && Math.abs(o.x - x) < 30 && Math.abs(o.y - (y + 14)) < 24) {
          o.done = true;
          o.n.classList.add('hit');
          y += 48;                            // 撞到障碍：被水冲回一截
        }
      });
      obs = obs.filter(function (o) {
        if (o.y > 680) { o.n.remove(); return false; }
        return true;
      });
      raft.style.left = x + 'px';
      raft.style.top = y + 'px';
      if (y <= 104) { finish(); return; }
      raf = requestAnimationFrame(loop);
    }
    Array.prototype.forEach.call(pad.querySelectorAll('b'), function (b) {
      var d = b.getAttribute('data-d');
      function down(ev) { ev.preventDefault(); ev.stopPropagation(); dir[d] = 1; }
      function up(ev) { if (ev) { ev.stopPropagation(); } dir[d] = 0; }
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
    });
    replay.addEventListener('click', function (ev) { ev.stopPropagation(); reset(); });
    box._stop = stop;
    reset();
  }

  /* ---------- 小游戏二：医护音游（节拍点全部命中才救治成功） ---------- */
  function startMedic(box) {
    box.innerHTML =
      '<div class="md-bg"></div>' +
      '<div class="md-room">' +
        '<div class="md-nurse"><img src="assets/img/小台.png" alt=""><b class="md-coat"></b></div>' +
        '<img class="md-patientImg" src="/attach/objects/49/497e0f1f6e2f09b8733a545bd80805654a73f92148d83eebf98072976b270fed" alt="">' +
        '<b class="md-mon"><svg viewBox="0 0 130 34">' +
          '<path d="M0 26h26l6-15 6 24 6-19 5 10h75"/></svg></b>' +
      '</div>' +
      '<div class="md-hint">亮起的节拍点要全部点到，才能把病人救回来</div>' +
      '<div class="md-field"></div>' +
      '<div class="md-line"></div>' +
      '<div class="md-bar"><i></i></div>' +
      '<div class="md-lanes">' +
        '<div class="md-lane" data-l="0">按压</div>' +
        '<div class="md-lane" data-l="1">通气</div>' +
        '<div class="md-lane" data-l="2">除颤</div>' +
        '<div class="md-lane" data-l="3">用药</div>' +
      '</div>' +
      '<div class="md-end"><span></span><b class="md-again">↻ 重玩</b></div>';
    var field = box.querySelector('.md-field');
    var line = box.querySelector('.md-line');
    var bar = box.querySelector('.md-bar i');
    var end = box.querySelector('.md-end');
    var endTxt = end.querySelector('span');
    var lanes = box.querySelectorAll('.md-lane');
    var HIT = 155, TOTAL = 12, LANE_W = 76, X0 = 8;   // HIT 是 .md-field 内部坐标（对应页面上的判定线）
    var notes = [], left = TOTAL, hits = 0, over = false, last = 0, raf = 0, acc = 0;

    function spawn() {
      var lane = Math.floor(Math.random() * 4);
      var n = el('div', 'md-note');
      n.style.left = (X0 + lane * LANE_W + 38 - 17) + 'px';
      n.style.top = '-40px';
      field.appendChild(n);
      notes.push({ n: n, lane: lane, y: -40 });
    }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    function reset() {
      stop();
      notes.forEach(function (o) { o.n.remove(); });
      notes = []; left = TOTAL; hits = 0; over = false; acc = 0;
      end.classList.remove('on');
      bar.style.width = '0%';
      for (var i = 0; i < 1; i++) spawn();
      last = Date.now();
      raf = requestAnimationFrame(loop);
    }
    function finish(ok) {
      over = true;
      stop();
      end.classList.add('on');
      end.classList.toggle('bad', !ok);
      endTxt.textContent = ok ? '救治成功！' : '抢救失败，再来一次';
    }
    function loop() {
      if (over) return;
      var now = Date.now();
      var dt = Math.min(42, now - last);
      last = now;
      acc += dt;
      while (left > 0 && notes.length < 1 && acc > 760) { acc = 0; spawn(); }   // 一个一个落，不同时
      var missed = false;
      notes.forEach(function (o) {
        o.y += dt * 0.2;
        o.n.style.top = o.y + 'px';
        o.n.classList.toggle('near', Math.abs(o.y - HIT) < 30);
        if (!o.done && o.y > HIT + 34) { o.done = true; missed = true; }
      });
      notes = notes.filter(function (o) { if (o.done) { o.n.remove(); return false; } return true; });
      if (missed) { finish(false); return; }
      raf = requestAnimationFrame(loop);
    }
    function tap(lane) {
      if (over) return;
      var best = null;
      notes.forEach(function (o) {
        if (o.lane !== lane || o.done) return;
        if (Math.abs(o.y - HIT) > 34) return;
        if (!best || Math.abs(o.y - HIT) < Math.abs(best.y - HIT)) best = o;
      });
      var l = lanes[lane];
      l.classList.add('flash');
      setTimeout(function () { l.classList.remove('flash'); }, 160);
      if (!best) return;                        // 空点不算命中
      best.done = true;
      best.n.remove();
      notes = notes.filter(function (o) { return o !== best; });
      left--; hits++;
      bar.style.width = Math.round(hits / TOTAL * 100) + '%';
      if (hits >= TOTAL) finish(true);          // 全部点中才算救治成功
    }
    Array.prototype.forEach.call(lanes, function (l, i) {
      l.addEventListener('pointerdown', function (ev) {
        ev.preventDefault(); ev.stopPropagation(); tap(i);
      });
    });
    end.querySelector('.md-again').addEventListener('click', function (ev) {
      ev.stopPropagation(); reset();
    });
    box._stop = stop;
    reset();
  }

  /* ---------- 小游戏三：邻里拔河（10 秒内快速向右滑动把绳子递过去） ---------- */
  function startBoliOld(box) {          // 旧版（已弃用，保留以防回退）
    box.innerHTML =
      '<div class="bl-bg"></div>' +
      '<img class="bl-mudImg" src="/attach/objects/13/13f60698f4371973740a82e0768eb37356e5a384eb48e5cb527538722b730d97" alt="">' +
      '<div class="bl-mud"></div>' +
      '<img class="bl-tractorImg" src="/attach/objects/f1/f196c6608473831fa0e5696f58777d8ef7f8b8d062c3e0fbfcd5e3fb6274818a" alt="">' +
      '<div class="bl-rope"><i></i></div>' +
      '<div class="bl-hand">绳头</div>' +
      '<div class="bl-people">' +
        '<img class="bl-v v3" src="/attach/objects/c3/c343ccdf981546b7b1c6c964698d5ba5522633cf78dd0c80cbe8ecbe927ce7f2" alt="">' +
        '<img class="bl-v v2" src="/attach/objects/15/150d49ec318db9b392e5e5eaa1aa0753843fe3257c106def16aeacba78bd1066" alt="">' +
        '<img class="bl-v v1" src="/attach/objects/c3/c343ccdf981546b7b1c6c964698d5ba5522633cf78dd0c80cbe8ecbe927ce7f2" alt="">' +
        '<img class="bl-chibi" src="assets/img/小台.png" alt="">' +
      '</div>' +
      '<div class="bl-hint">10 秒内快速向右滑动屏幕，帮他们把拖拉机拉出泥潭</div>' +
      '<div class="bl-time">10</div>' +
      '<div class="bl-bar"><i></i></div>' +
      '<div class="bl-replay">↻ 重玩</div>' +
      '<div class="bl-end"><span></span></div>';
    var rope = box.querySelector('.bl-rope');
    var hand = box.querySelector('.bl-hand');
    var tractor = box.querySelector('.bl-tractor');
    var timeEl = box.querySelector('.bl-time');
    var bar = box.querySelector('.bl-bar i');
    var end = box.querySelector('.bl-end');
    var endTxt = end.querySelector('span');
    var prog = 0, over = false, left = 10000, last = 0, raf = 0, lx = 0, lt = 0, power = 0;

    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    function paint() {
      var p = Math.max(0, Math.min(1, prog));
      rope.style.width = (46 + p * 62) + 'px';       // 绳子从拖拉机尾部伸向村民
      hand.style.left = (100 + p * 118) + 'px';
      tractor.style.transform = 'translateX(' + (p * 26).toFixed(1) + 'px) rotate(' + (p * 3).toFixed(1) + 'deg)';
      bar.style.width = Math.round(p * 100) + '%';
    }
    function reset() {
      stop();
      prog = 0; over = false; left = 10000; power = 0;
      end.classList.remove('on', 'bad');
      timeEl.textContent = '10.0';
      paint();
      last = Date.now();
      raf = requestAnimationFrame(loop);
    }
    function finish(ok) {
      over = true;
      stop();
      end.classList.add('on');
      end.classList.toggle('bad', !ok);
      endTxt.textContent = ok ? '拉出来了！' : '时间到，再来一次';
    }
    function loop() {
      if (over) return;
      var now = Date.now();
      var dt = Math.min(50, now - last);
      last = now;
      left -= dt;
      if (left <= 0) { left = 0; timeEl.textContent = '0.0'; finish(false); return; }
      timeEl.textContent = (left / 1000).toFixed(1);
      // 只有快速右滑才明显推进；否则被泥沼拖回去
      prog += power * dt * 0.00042;
      power *= 0.90;
      prog -= dt * 0.000020;
      if (prog < 0) prog = 0;
      if (prog >= 1) { prog = 1; paint(); finish(true); return; }
      paint();
      raf = requestAnimationFrame(loop);
    }
    function move(e) {
      if (over) return;
      var now = Date.now();
      var x = e.clientX;
      var dx = x - lx;
      var dt = Math.max(8, now - lt);
      lx = x; lt = now;
      var speed = dx / dt;                       // px/ms
      if (dx <= 2 || speed < 0.55) return;       // 慢慢划、往回划都不算
      power = Math.min(3.2, power + speed * 0.9 - 0.35);
    }
    function down(e) { lx = e.clientX; lt = Date.now(); }
    function onDown(e) { e.stopPropagation(); down(e); }
    function onMove(e) { e.stopPropagation(); move(e); }
    function onTS(e) { e.stopPropagation(); if (e.touches[0]) down(e.touches[0]); }
    function onTM(e) { e.stopPropagation(); if (e.touches[0]) move(e.touches[0]); }
    box.addEventListener('pointerdown', onDown);
    box.addEventListener('pointermove', onMove);
    box.addEventListener('touchstart', onTS, { passive: true });
    box.addEventListener('touchmove', onTM, { passive: true });
    var again = end.querySelector('.bl-again');
    if (again) again.addEventListener('click', function (ev) { ev.stopPropagation(); reset(); });
    var rp = box.querySelector('.bl-replay');
    if (rp) rp.addEventListener('click', function (ev) { ev.stopPropagation(); reset(); });
    box._stop = function () {
      stop();
      box.removeEventListener('pointerdown', onDown);
      box.removeEventListener('pointermove', onMove);
      box.removeEventListener('touchstart', onTS);
      box.removeEventListener('touchmove', onTM);
    };
    reset();
  }

  /* ============================================================
     小游戏三（重做版）：泥沼拔河
     最左拖拉机 + 一根绳 → 10 秒内快速向右滑动，绳子才会往右走，
     一路递到最右三个小人手里，拖拉机被拉出泥潭。全程没有「手」的图形。
  ============================================================ */
  function startBoli(box) {
    box.innerHTML =
      '<div class="bw-mud"></div>' +
      '<div class="bw-tractor">' +
        '<i class="bw-cab"></i><i class="bw-hood"></i><i class="bw-body"></i>' +
        '<i class="bw-stack"></i><i class="bw-w1"></i><i class="bw-w2"></i>' +
      '</div>' +
      '<div class="bw-rope"><i class="bw-head"></i></div>' +
      '<div class="bw-people">' +
        '<img class="bw-v v1" src="assets/img/村民女.png" alt="">' +
        '<img class="bw-v v2" src="assets/img/村民男.png" alt="">' +
        '<img class="bw-chibi" src="assets/img/小台.png" alt="">' +
      '</div>' +
      '<div class="bw-hint">10 秒内快速向右滑动屏幕，把绳子递给村民，一起把拖拉机拉出泥潭</div>' +
      '<div class="bw-time">10</div>' +
      '<div class="bw-bar"><i></i></div>' +
      '<div class="bw-again">↻ 重玩</div>' +
      '<div class="bw-end"><span></span></div>';

    var rope = box.querySelector('.bw-rope');
    var head = box.querySelector('.bw-head');
    var tractor = box.querySelector('.bw-tractor');
    var timeEl = box.querySelector('.bw-time');
    var bar = box.querySelector('.bw-bar i');
    var end = box.querySelector('.bw-end');
    var endTxt = end.querySelector('span');
    var prog = 0, over = false, left = 10000, last = 0, raf = 0;
    var lx = 0, lt = 0, power = 0;

    function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
    function paint() {
      var p = prog < 0 ? 0 : (prog > 1 ? 1 : prog);
      var w = 30 + p * 152;                     // 绳子从 30px 拉到 182px，拉起来显得长
      rope.style.width = w.toFixed(1) + 'px';
      head.style.left = (w - 9).toFixed(1) + 'px';
      tractor.style.transform = 'translate(' + (p * 32).toFixed(1) + 'px,' + (p * 2).toFixed(1) +
        'px) rotate(' + (p * 4).toFixed(1) + 'deg)';
      bar.style.width = Math.round(p * 100) + '%';
    }
    function reset() {
      stop();
      prog = 0; over = false; left = 10000; power = 0;
      end.classList.remove('on');
      endTxt.textContent = '';
      timeEl.textContent = '10';
      paint();
      last = Date.now();
      raf = requestAnimationFrame(loop);
    }
    function finish(ok) {
      over = true;
      stop();
      end.classList.add('on');
      endTxt.textContent = ok ? '拉出来了！' : '时间到，再来一次';
      endTxt.style.color = ok ? '#fff' : '#ffd9d5';
    }
    function loop() {
      if (over) return;
      var now = Date.now();
      var dt = Math.min(50, now - last);
      last = now;
      left -= dt;
      if (left <= 0) { left = 0; timeEl.textContent = '0'; finish(false); return; }
      timeEl.textContent = String(Math.ceil(left / 1000));
      prog += power * dt * 0.00040;      // 只有快滑累积起来的力道才推进
      power *= 0.88;                     // 每帧衰减，必须连续快划
      prog -= dt * 0.000018;             // 泥潭往回拽
      if (prog >= 1) { prog = 1; paint(); finish(true); return; }
      paint();
      raf = requestAnimationFrame(loop);
    }
    function move(e) {
      if (over) return;
      var now = Date.now();
      var x = e.clientX;
      var dx = x - lx;
      var dt = Math.max(8, now - lt);
      lx = x; lt = now;
      var speed = dx / dt;                       // px/ms
      if (dx <= 2 || speed < 0.5) return;        // 慢滑、左滑都不算
      power = Math.min(3.2, power + speed * 0.85 - 0.3);
    }
    function down(e) { lx = e.clientX; lt = Date.now(); }
    function onDown(e) { e.stopPropagation(); down(e); }
    function onMove(e) { e.stopPropagation(); move(e); }
    function onTS(e) { e.stopPropagation(); if (e.touches[0]) down(e.touches[0]); }
    function onTM(e) { e.stopPropagation(); if (e.touches[0]) move(e.touches[0]); }
    box.addEventListener('pointerdown', onDown);
    box.addEventListener('pointermove', onMove);
    box.addEventListener('touchstart', onTS, { passive: true });
    box.addEventListener('touchmove', onTM, { passive: true });
    var again = box.querySelector('.bw-again');
    if (again) again.addEventListener('click', function (ev) { ev.stopPropagation(); reset(); });
    box._stop = function () {
      stop();
      box.removeEventListener('pointerdown', onDown);
      box.removeEventListener('pointermove', onMove);
      box.removeEventListener('touchstart', onTS);
      box.removeEventListener('touchmove', onTM);
    };
    reset();
  }

  /* ---------- 主流程渲染 ---------- */
  function build() {
    deck.innerHTML = '';
    els = [];
    MAIN.forEach(function (pg, i) {
      var p = buildPage(pg, i);
      deck.appendChild(p);
      els.push(p);
    });
    // 全新的「风停之后」放在最后；目录页「长城」指向它
    var after = buildAfterPage();
    deck.appendChild(after);
    els.push(after);
    var wallIdx = els.length;                // 目录页 splice 进来后，它整体后移一位 = 现在的长度
    var menu = buildMenuPage(wallIdx);
    if (els[2]) deck.insertBefore(menu, els[2]); else deck.appendChild(menu);
    els.splice(2, 0, menu);
    decorateP1(els[0]);
    decorateP2(els[1]);
    // els[2] 是目录页，无需装饰
    decorateP3(els[3]);
    decorateP4(els[4]);
    decorateP5(els[5]);
    decorateP6(els[6]);
    addBack(els[9]);             // 抗洪英雄图鉴：只加一个返回目录的按钮
    // 所有页面底色都换成浅色雾霾图，不再有深色页
    var darkIdx = {};
    els.forEach(function (p, i) {
      if (darkIdx[i] != null) p.classList.add('dark-page');
    });
    go(0, true);
  }

  /* ---------- 翻页 ---------- */
  function go(i, instant) {
    if (i < 0 || i >= els.length) return;
    var prev = els[cur];
    var next = els[i];
    if (prev && prev !== next) {
      prev._lock = false;                  // 离开某页时解除它的流程锁
      if (!instant) {
        prev.classList.remove('on');
        prev.classList.add('out');
        setTimeout(function () { prev.classList.remove('out'); }, 700);
      } else {
        prev.classList.remove('on');
      }
    }
    cur = i;
    if (next) {
      // 重置动画：重新插入触发
      next.querySelectorAll('[class*="a-"]').forEach(function (n) {
        var cls = Array.prototype.filter.call(n.classList, function (c) { return c.indexOf('a-') === 0; });
        cls.forEach(function (c) { n.classList.remove(c); void n.offsetWidth; n.classList.add(c); });
      });
      next.classList.add('on');
      if (next._scroll) next._scroll.scrollTop = 0;
      if (deck) deck.scrollTop = 0;
      document.body.classList.toggle('dark', next.classList.contains('dark-page'));
    }
    // HUD
    var no = document.getElementById('curNo');
    var bar = document.getElementById('bar');
    var tot = document.getElementById('totNo');
    if (no) no.textContent = String(i + 1);
    if (tot) tot.textContent = String(els.length);
    if (bar) bar.style.width = ((i + 1) / els.length * 100).toFixed(1) + '%';
    document.getElementById('prevBtn').disabled = (i === 0);
    // 正文第一页（灾情播报）响起播报音，离开则停
    if (i === 1) playNews(); else stopNews();
  }
  function next() { if (cur < ENTRY_LAST) go(cur + 1); }
  function prev() { if (cur > 0) go(cur - 1); }

  // 主项目返回目录时复用同一个 teshu 页面，避免重新加载图片和动画。
  window.addEventListener('message', function (ev) {
    var d = ev && ev.data;
    if (!d || d.type !== 'teshu-open-menu') return;
    go(2, true);
  });

  /* ---------- 弹窗 ---------- */
  function openPopup(pageData) {
    var pop = document.getElementById('popup');
    var body = document.getElementById('popupBody');
    body.innerHTML = '';
    var wrap = el('div', 'pp');
    (pageData.els || []).forEach(function (e) {
      var node = null;
      if (e.t === '7') {
        node = el('div', 'el el-text');
        node.innerHTML = dec(e.html || esc(e.txt));
        if (e.ic) node.style.color = readableColor(e.ic);
      } else if (e.t === '4' || e.t === 'h' || e.t === 'p') {
        node = img(e.src, (e.t === 'p') ? 'cover' : '');
      } else if (e.t === 'o') {
        node = videoNode(e);
      } else return;
      place(node, e);
      applyAnim(node, e);
      wrap.appendChild(node);
    });
    body.appendChild(wrap);
    pop.hidden = false;
    pop.style.display = '';          // 交还给 CSS 的 grid 布局
    scalePopup();
  }
  function closePopup() {
    var p = document.getElementById('popup');
    if (!p) return;
    p.hidden = true;
    p.style.display = 'none';        // 双保险
    var v = p.querySelector('video');
    if (v && !v.paused) v.pause();   // 关闭时停止播放
  }
  function scalePopup() {
    var body = document.getElementById('popupBody');
    var sc = body.querySelector('.pp');
    if (!sc) return;
    var w = body.clientWidth;
    var s = w / PAGE_W;
    sc.style.transform = 'scale(' + s + ')';
    sc.style.transformOrigin = 'top left';
    sc.style.position = 'absolute';
    body.style.height = (PAGE_H * s) + 'px';
  }

  /* ---------- 缩放：手机画布尺寸 + 内容等比铺满 ---------- */
  // 画布尺寸：屏幕比手机更窄长 → 铺满整屏；屏幕更宽 → 居中的手机竖屏画布
  function canvasSize(vw, vh) {
    var w;
    if (vw / vh <= PHONE_RATIO) {
      w = vw;
    } else {
      w = Math.max(PAGE_W, Math.round(vh * PHONE_RATIO));
      if (w > vw) w = vw;
    }
    return { w: w, h: vh };
  }
  // 每页内容高度：至少铺满当前画布，长页按内容高度
  function layoutInner() {
    els.forEach(function (p) {
      if (!p._inner) return;
      p._inner.style.height = Math.max(p._long || 0, viewH) + 'px';
    });
  }
  function resize() {
    var vw = window.innerWidth || document.documentElement.clientWidth;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    if (window.visualViewport) {
      vw = Math.max(vw, window.visualViewport.width);
      vh = Math.max(vh, window.visualViewport.height);
    }
    var box = canvasSize(vw, vh);
    var s = box.w / PAGE_W;          // 内容等比缩放：横向正好铺满画布
    viewH = box.h / s;               // 画布对应的设计高度
    if (wrap) {
      wrap.style.width = box.w + 'px';
      wrap.style.height = box.h + 'px';
      wrap.style.setProperty('--phone-w', box.w + 'px');
    }
    deck.style.width = PAGE_W + 'px';
    deck.style.height = viewH + 'px';
    // transform-origin:top left → 缩放后视觉尺寸 = 画布尺寸，正好铺满且居中
    deck.style.transform = 'scale(' + s + ')';
    layoutInner();
    layoutP2();
    layoutP3();
    if (!document.getElementById('popup').hidden) scalePopup();
  }

  /* ---------- Background music: start with the cover when allowed ---------- */
  function initBgm() {
    bgm = document.getElementById('bgm');
    bgmBtn = document.getElementById('bgmBtn');
    var unlockBtn = document.getElementById('bgmUnlock');
    if (!bgm || !bgmBtn) return;
    bgm.volume = 0.55;
    bgm.muted = false;
    bgm.loop = true;
    var wantPlay = true;
    var hideUnlock = function () { if (unlockBtn) unlockBtn.hidden = true; };
    var showUnlock = function () {
      if (wantPlay && bgm.paused && unlockBtn) unlockBtn.hidden = false;
    };
    var tryPlay = function () {
      if (!wantPlay || !bgm.paused) return;
      bgm.muted = false;
      try {
        var p = bgm.play();
        if (p && p.then) p.then(hideUnlock, showUnlock);
      } catch (e) { showUnlock(); }
    };
    var kick = function (ev) {
      // The music buttons handle their own click; do not start and then pause in one gesture.
      if (ev && ev.target &&
          (bgmBtn.contains(ev.target) || (unlockBtn && unlockBtn.contains(ev.target)))) return;
      tryPlay();
    };
    var gestures = ['pointerdown', 'touchstart', 'click', 'keydown'];
    gestures.forEach(function (ev) { window.addEventListener(ev, kick, true); });
    bgm.addEventListener('canplay', kick);
    bgm.addEventListener('loadeddata', kick);
    bgm.addEventListener('loadedmetadata', kick);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });
    document.addEventListener('WeixinJSBridgeReady', tryPlay, false);
    var stopKick = function () {
      gestures.forEach(function (ev) { window.removeEventListener(ev, kick, true); });
      bgm.removeEventListener('canplay', kick);
      bgm.removeEventListener('loadeddata', kick);
      bgm.removeEventListener('loadedmetadata', kick);
    };
    bgm.addEventListener('playing', function () {
      audioUnlocked = true;
      bgmBtn.classList.add('playing');
      bgmBtn.classList.remove('muted');
      hideUnlock();
      stopKick();
    });
    bgm.addEventListener('play', function () {
      bgmBtn.classList.add('playing');
      if (!bgm.muted) bgmBtn.classList.remove('muted');
    });
    bgm.addEventListener('pause', function () { bgmBtn.classList.remove('playing'); });
    bgmBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (bgm.paused || bgm.muted) {
        wantPlay = true;
        tryPlay();
      } else {
        wantPlay = false;
        bgm.pause();
        hideUnlock();
        bgmBtn.classList.add('muted');
      }
    });
    if (unlockBtn) unlockBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      wantPlay = true;
      tryPlay();
    });
    // The browser may reject audible autoplay. Its first user gesture starts the same track.
    if (bgm.paused) tryPlay();
    else { bgmBtn.classList.add('playing'); hideUnlock(); stopKick(); }
  }

  /* ---------- 正文第一页的台风播报音（在这一页循环播放） ---------- */
  function initNews() {
    news = document.getElementById('news');
    if (!news) return;
    news.volume = 1;
    news.loop = true;                    // 第二页一直循环，不因点击重头播
    // 播报响起时把背景音乐压小，播完/暂停后恢复
    news.addEventListener('play', function () { if (bgm) bgm.volume = 0.16; });
    news.addEventListener('pause', function () { if (bgm && !bgm.paused) bgm.volume = 0.55; });
  }
  // 进入第二页（或它被暂停时）才从头播；已经在播就不动它
  function playNews() {
    if (!news || !news.paused) return;
    try { news.currentTime = 0; } catch (e) { /* 尚未就绪 */ }
    var p = news.play();
    if (p && p.catch) p.catch(function () { /* 被自动播放策略拦截 */ });
  }
  function stopNews() {
    if (news && !news.paused) news.pause();
  }

  /* ---------- 交互绑定 ---------- */
  function bindGlobal() {
    document.getElementById('nextBtn').addEventListener('click', next);
    document.getElementById('prevBtn').addEventListener('click', prev);
    document.getElementById('popupClose').addEventListener('click', closePopup);
    document.getElementById('popupMask').addEventListener('click', closePopup);
    // 键盘
    window.addEventListener('keydown', function (e) {
      var kp = els[cur];
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        if (kp && kp._lock) return;              // 该页流程未走完，键盘也不许翻
        next();
      }
      else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); prev(); }
      else if (e.key === 'Escape') closePopup();
    });
    // 滚轮翻页（长页内滚动到底再翻）
    var wheelLock = false;
    window.addEventListener('wheel', function (e) {
      var p = els[cur];
      if (p && p._lock && e.deltaY > 0) return;   // 该页流程未走完，禁止下滑/翻页
      if (p && p._scroll) {
        var sc = p._scroll;
        var atTop = sc.scrollTop <= 0;
        var atBot = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2;
        if ((e.deltaY > 0 && !atBot) || (e.deltaY < 0 && !atTop)) return; // 页面内滚动
      }
      if (wheelLock) return;
      wheelLock = true;
      setTimeout(function () { wheelLock = false; }, 780);
      if (e.deltaY > 0) next(); else prev();
    }, { passive: true });
    // 触摸滑动（拖温度计时不参与翻页）
    var ty = 0, tx = 0, tt = 0, swipeBlocked = false;
    window.addEventListener('touchstart', function (e) {
      swipeBlocked = !!(e.target && e.target.closest &&
        (e.target.closest('.p3-thermo') || e.target.closest('.p3-wheel')));
      if (e.touches.length !== 1) return;
      ty = e.touches[0].clientY; tx = e.touches[0].clientX; tt = Date.now();
    }, { passive: true });
    window.addEventListener('touchend', function (e) {
      if (e.touches.length) return;
      var t = e.changedTouches[0];
      var dy = t.clientY - ty, dx = t.clientX - tx;
      var dt = Date.now() - tt;
      if (swipeBlocked) { swipeBlocked = false; return; }
      if (dt > 900) return;
      var p = els[cur];
      if (p && p._lock && dy < 0) return;       // 该页流程未走完，禁止上滑进下一页
      if (Math.abs(dy) > 46 && Math.abs(dy) > Math.abs(dx)) {
        if (p && p._scroll) {
          var sc = p._scroll;
          var atTop = sc.scrollTop <= 0;
          var atBot = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2;
          if (dy < 0 && !atBot) return;
          if (dy > 0 && !atTop) return;
        }
        if (dy < 0) next(); else prev();
      }
    }, { passive: true });
    // 点击空白翻页：封面保留「点击屏幕」进入下一页
    stage.addEventListener('click', function (e) {
      if (e.target.closest('.hot') || e.target.closest('button') || e.target.closest('a')) return;
      if (e.target.closest('.page-scroll') && cur > 0) return;
      if (cur === 0) next();
    });
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 180); });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', resize);
      window.visualViewport.addEventListener('scroll', resize);
    }
    if (window.ResizeObserver) {
      new ResizeObserver(resize).observe(document.documentElement);
    }
    // 首屏多帧校准（字体/图片加载后可能改变布局）
    [60, 240, 600, 1200].forEach(function (t) { setTimeout(resize, t); });
  }

  /* ---------- 热点：年份卡 / 档案卡 ---------- */
  function bindHotspots() {
    els.forEach(function (page) {
      var idx = parseInt(page.dataset.page, 10);
      // P5 / P13：点击查看台风动态路径图 → 打开对应年份弹窗
      if (idx === 5 || idx === 13) {
        page.querySelectorAll('.el-text').forEach(function (n) {
          var t = (n.textContent || '');
          if (t.indexOf('点击') >= 0 || /^20\d\d年/.test(t.trim())) {
            n.style.cursor = 'pointer';
            n.addEventListener('click', function (ev) {
              ev.stopPropagation();
              openPopup(POPS[1]);
            });
          }
        });
      }
      // P11：沿海/内陆档案卡
      if (idx === 11) {
        page.querySelectorAll('.el-text').forEach(function (n) {
          var t = (n.textContent || '').trim();
          if (t === '沿海' || t === '内陆') {
            n.style.cursor = 'pointer';
            n.addEventListener('click', function (ev) {
              ev.stopPropagation();
              openPopup(POPS[t === '沿海' ? 1 : 7]);
            });
          }
        });
      }
    });
    // 弹窗打开时显示关闭按钮
    document.getElementById('popupClose').addEventListener('click', closePopup);
  }

  /* ---------- 启动 ---------- */
  function boot() {
    stage = document.getElementById('stage');
    deck = document.getElementById('deck');
    // 手机画布已在 index.html 中就位：#phone 就是缩放后的可视屏幕
    wrap = document.getElementById('phone');
    // 即使某一步出错，也保证画布尺寸/翻页交互可用（避免整页空白）
    try { build(); } catch (err) { if (window.console) console.error(err); }
    bindGlobal();
    bindHotspots();
    resize();
    initBgm();
    initNews();
    // 第二页的播报音：只在它还没响起来时补播一次；已经在循环就绝不重头播
    window.addEventListener('pointerdown', function () {
      if (cur === 1 && news && news.paused) playNews();
    }, true);
    // 暴露给调试
    window.TESHU = {
      go: go, next: next, prev: prev, openPopup: openPopup, closePopup: closePopup,
      pages: MAIN, pops: POPS, get cur() { return cur; }
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
