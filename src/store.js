/* ---------- store.js ----------
   数据落地：localStorage 只是缓存，workbench-sync.json 才是真身。
   还包括「存不住就得说存不住」的探测，和底部那条浮动提示。 */

/* ---------- 存储 ----------
   两层：localStorage 只是缓存，workbench-sync.json 才是真身。
   换文件名、换浏览器、清缓存，缓存全丢也没关系——json 还在，打开就收回来。
   反过来只靠 localStorage 就是这一版之前的样子：改个名数据就没了。 */
var KEY = 'myworkbench.v1';

/* 图标 */
var IC = {
  today:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="3.3"/><path d="M8 1.3v1.5M8 13.2v1.5M1.3 8h1.5M13.2 8h1.5M3.3 3.3l1 1M11.7 11.7l1 1M12.7 3.3l-1 1M4.3 11.7l-1 1"/></svg>',
  inbox:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M2 9.2V13h12V9.2"/><path d="M2 9.2l2-6h8l2 6"/><path d="M2 9.2h3.2l.9 1.6h3.8l.9-1.6H14"/></svg>',
  folder:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M1.9 12.7V3.8h4.3l1.5 1.9h6.4v7z"/></svg>',
  note:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3.3" y="2.2" width="9.4" height="11.6" rx="1.4"/><path d="M5.7 5.7h4.6M5.7 8.1h4.6M5.7 10.5h3"/></svg>',
  review:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 11.6l3.5-3.9 2.5 2.1 5.3-5.9"/><path d="M2.2 14h11.6"/></svg>',
  pin:'<svg class="pin" viewBox="0 0 16 16"><path d="M8 1.5l1.95 3.95 4.35.63-3.15 3.07.75 4.33L8 11.44 4.1 13.5l.75-4.33L1.7 6.08l4.35-.63z"/></svg>',
  starOn:'<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.9l1.83 3.7 4.09.6-2.96 2.88.7 4.07L8 11.2l-3.66 1.95.7-4.07L2.08 6.2l4.09-.6z"/></svg>',
  starOff:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"><path d="M8 2.4l1.72 3.48 3.85.56-2.79 2.71.66 3.83L8 11.16l-3.44 1.82.66-3.83L2.43 6.44l3.85-.56z"/></svg>',
  x:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4.4 4.4l7.2 7.2M11.6 4.4l-7.2 7.2"/></svg>',
  sync:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5.8 13.8h8.4a3 3 0 0 0 .35-5.98A4.4 4.4 0 0 0 6.05 6.9a3.1 3.1 0 0 0-.25 6.9z"/><path d="M8.2 10.7l1.8-1.8 1.8 1.8"/></svg>',
  arrow:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h9.5M9 4.5L12.5 8 9 11.5"/></svg>'
};

var VIEWS = [
  {k:'today', label:'今日', ic:'today'},
  {k:'inbox', label:'收件箱', ic:'inbox'},
  {k:'projects', label:'项目', ic:'folder'},
  {k:'notes', label:'笔记', ic:'note'},
  {k:'review', label:'回顾', ic:'review'},
  {k:'sync', label:'同步', ic:'sync'}
];

var S = null;

/* ---------- 存储 ---------- */

/* 有些预览环境（iframe 沙箱）不给 localStorage。存不住就要说存不住，
   不能底部写着「已保存」而刷新之后什么都没了。 */
var CAN_SAVE = (function(){
  try {
    localStorage.setItem('__wb_probe__','1');
    localStorage.removeItem('__wb_probe__');
    return true;
  } catch(e){ return false; }
})();

function load(){
  var d = null;
  try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch(e){ d = null; }
  if (!d || !Array.isArray(d.todos)) {
    d = { todos:[], inbox:[], view:'today', mini:false, lastSave:0 };
  }
  if (!Array.isArray(d.inbox)) d.inbox = [];
  if (!d.view) d.view = 'today';

  /* 同步要用两样东西：设备标识，和每条记录的最后修改时间。
     老数据没有 up，用 created 兜底，避免一上来就被判成「最旧」。 */
  if (!d.devId) d.devId = uid();
  var t0 = Date.now();
  d.todos.concat(d.inbox).forEach(function(x){
    if (!x.up) x.up = x.created || t0;
    if (x.del === undefined) x.del = 0;
  });
  return d;
}

function save(){
  S.lastSave = Date.now();
  if (CAN_SAVE) {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch(e){ CAN_SAVE = false; }
  }
  stampSync();
}

function stampSync(){
  var el = document.getElementById('st');
  if (!el) return;
  if (!CAN_SAVE) {
    el.textContent = '临时模式 · 关掉就没了';
    clearTimeout(stampSync._t);
    return;
  }
  el.textContent = '已保存 · 刚刚';
  clearTimeout(stampSync._t);
  stampSync._t = setTimeout(function(){
    var el2 = document.getElementById('st');
    if (el2) el2.textContent = '已保存 · 本地';
  }, 2600);
}

/* ---------- 浮动提示 ---------- */
var toastFn = null, toastTimer = null;
function toast(msg, undoFn){
  var el = document.getElementById('toast');
  el.querySelector('.m').textContent = msg;
  var u = document.getElementById('undo');
  if (undoFn) { u.hidden = false; toastFn = undoFn; }
  else { u.hidden = true; toastFn = null; }
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, undoFn ? 5200 : 2200);
}
function hideToast(){
  var el = document.getElementById('toast');
  if (el) el.classList.remove('on');
  toastFn = null;
}
