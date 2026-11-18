/* ---------- media.js ----------
   把「一行 URL」变成「能看的东西」。三类：
     1. 视频      B 站 / YouTube / Vimeo / 直链 mp4 → iframe 或 <video>
     2. 图片      png jpg gif webp svg → <img>
     3. 两个外站  飞书文档、WPS 云文档 → 卡片跳转（它们禁 iframe，见下）

   为什么飞书和 WPS 不给嵌：2026-11-18 实测
     docs.feishu.cn → x-frame-options: DENY
     飞书官方 FAQ 自认 iframe 内 cookie 不可用、扫码都登不上
   WPS 同理（自家站点靠登录态）。这类只做「点开去那边看」，不硬塞。

   ⚠️ B 站没有返 x-frame-options，所以能嵌。哪天它加了，这里会变成一块空白——
      所以每个 iframe 下面都留一行原文链接，页一坏就能点过去。 */

/* 视频源的识别规则。顺序有讲究：先匹配具体的，再匹配通用的。 */
var MEDIA_RULES = [
  {
    k: 'bili',
    re: /^https?:\/\/(?:www\.)?bilibili\.com\/video\/(BV[0-9A-Za-z]+)/,
    frame: function(m){
      return 'https://player.bilibili.com/player.html?bvid=' + m[1]
        + '&autoplay=0&high_quality=1&danmaku=0';
    },
    label: 'B 站'
  },
  {
    k: 'bili',
    re: /^https?:\/\/b23\.tv\/([0-9A-Za-z]+)/,
    frame: null,
    label: 'B 站短链'
  },
  {
    k: 'yt',
    re: /^https?:\/\/(?:www\.|m\.)?youtube\.com\/watch\?v=([\w-]{6,})/,
    frame: function(m){ return 'https://www.youtube.com/embed/' + m[1]; },
    label: 'YouTube'
  },
  {
    k: 'yt',
    re: /^https?:\/\/youtu\.be\/([\w-]{6,})/,
    frame: function(m){ return 'https://www.youtube.com/embed/' + m[1]; },
    label: 'YouTube'
  },
  {
    k: 'vimeo',
    re: /^https?:\/\/(?:www\.)?vimeo\.com\/(\d+)/,
    frame: function(m){ return 'https://player.vimeo.com/video/' + m[1]; },
    label: 'Vimeo'
  },
  {
    k: 'mp4',
    re: /^https?:\/\/\S+\.(?:mp4|webm|ogg)(?:\?\S*)?$/i,
    video: true,
    label: '视频文件'
  },
  {
    k: 'img',
    re: /^https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg|avif)(?:\?\S*)?$/i,
    img: true,
    label: '图片'
  },
  {
    k: 'feishu',
    re: /^https?:\/\/([\w-]+\.)?(feishu\.cn|larksuite\.com|feishu-boe\.cn)\/\S*/,
    label: '飞书文档'
  },
  {
    k: 'wps',
    re: /^https?:\/\/(?:www\.)?(kdocs\.cn|wps\.cn|docer\.wps\.cn)\/\S*/,
    label: 'WPS 云文档'
  },
  {
    /* mermaid.ink/img/<base64> 这种，本身就是一张图 */
    k: 'img',
    re: /^https?:\/\/mermaid\.ink\/(?:img|svg)\//,
    img: true,
    label: 'Mermaid 图'
  }
];

function detectMedia(url){
  var u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u)) return null;
  for (var i = 0; i < MEDIA_RULES.length; i++) {
    var r = MEDIA_RULES[i];
    var m = u.match(r.re);
    if (!m) continue;
    return {
      k: r.k,
      label: r.label,
      url: u,
      frame: r.frame ? r.frame(m) : null,
      video: !!r.video,
      img: !!r.img
    };
  }
  return null;
}

/* 一段文本里混着普通文字和链接时，只取第一个链接判类型。
   返回 null 表示「这不是一条媒体」，按普通文本处理。 */
function mediaOfText(text){
  var t = String(text || '').trim();
  var m = t.match(/https?:\/\/\S+/);
  if (!m) return null;
  var hit = detectMedia(m[0]);
  if (!hit) return null;
  /* 只有整条就是一个链接才当媒体，否则「看看这个 https://… 怎么样」会被吞掉 */
  return hit.url === t ? hit : null;
}

/* ---------- 渲染 ---------- */

function mediaBlock(item){
  var src = item.src;
  var h = '<div class="md1">';

  if (src.img) {
    h += '<a class="md-img" href="' + esc(src.url) + '" target="_blank" rel="noopener noreferrer">'
      + '<img src="' + esc(src.url) + '" alt="" loading="lazy"></a>';
  } else if (src.video) {
    h += '<video class="md-vid" controls preload="metadata" src="' + esc(src.url) + '"></video>';
  } else if (src.frame) {
    /* 竖屏视频（B 站 / YouTube Shorts）在 iframe 里会上下留大黑边，这里按比例给高度 */
    h += '<div class="md-fr"><iframe src="' + esc(src.frame) + '" loading="lazy"'
      + ' allow="accelerometer; encrypted-media; picture-in-picture; fullscreen"'
      + ' allowfullscreen referrerpolicy="no-referrer"></iframe></div>';
  } else {
    /* 飞书 / WPS / B 站短链：点开去那边 */
    h += '<a class="md-go" href="' + esc(src.url) + '" target="_blank" rel="noopener noreferrer">'
      + '<span class="md-go-t">' + esc(src.label) + '</span>'
      + '<span class="md-go-u">' + esc(src.url.replace(/^https?:\/\//, '').slice(0, 48)) + '</span>'
      + '<span class="md-go-a">打开</span></a>';
  }

  h += '<div class="md1-f"><span class="md1-k">' + esc(src.label) + '</span>';
  if (item.text && item.text !== src.url) {
    h += '<span class="md1-t">' + esc(item.text) + '</span>';
  }
  h += '</div></div>';
  return h;
}

/* 笔记正文：Markdown 渲染 + 净化。
   净化这一步不能省 —— 笔记内容会被存进同步文件，那个文件是能被别人写进来的
   （共享仓库 / 另一台设备 / 手改）。不净化就等于给脚本执行开了个口子。 */
function mdRender(md){
  if (typeof marked === 'undefined') return '<pre>' + esc(md) + '</pre>';
  var raw;
  try {
    raw = marked.parse(String(md || ''), { breaks: true, gfm: true });
  } catch(e){
    return '<pre>' + esc(md) + '</pre>';
  }
  if (typeof DOMPurify !== 'undefined') {
    /* 允许保留图片、链接、表格；不放开 iframe/script/style */
    return DOMPurify.sanitize(raw, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ['target', 'rel'],
      FORBID_TAGS: ['iframe', 'script', 'style', 'form', 'input'],
      FORBID_ATTR: ['style', 'onerror', 'onload']
    });
  }
  return '<pre>' + esc(md) + '</pre>';
}

/* 把正文里的 mermaid 代码块换成图。
   mermaid.ink 是纯 GET 的渲染服务，2026-11-18 实测：POST 一段流程图过去
   返回 image/png 200 / 7.6KB。它不渲染中文以外的复杂布局，但流程图、时序图、思维导图都行。
   好处是不用把 3.5MB 的 mermaid.js 塞进来；坏处是断网就看不到图 —— 所以留了代码块原文。 */
function mermaidSrc(code){
  var state = { code: code, mermaid: JSON.stringify({ theme: 'default' }) };
  var b64 = b64enc(JSON.stringify(state)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return 'https://mermaid.ink/img/' + b64 + '?type=png';
}

/* node 测试用出口：浏览器里 module 不存在，整段跳过 */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { detectMedia: detectMedia, mediaOfText: mediaOfText, MEDIA_RULES: MEDIA_RULES };
}
