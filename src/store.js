/* ---------- store.js ----------
   数据落地：localStorage 只是缓存，workbench-sync.json 才是真身。
   还包括「存不住就得说存不住」的探测，和底部那条浮动提示。 */

/* ---------- 存储 ----------
   两层：localStorage 只是缓存，workbench-sync.json 才是真身。
   换文件名、换浏览器、清缓存，缓存全丢也没关系——json 还在，打开就收回来。
   反过来只靠 localStorage 就是这一版之前的样子：改个名数据就没了。 */
var KEY = 'myworkbench.v1';

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
    /* 四象限的两个标记是后加的字段。老数据没有，补 0 而不是 undefined ——
       否则 mergeRecords 比 up 时 undefined 参与运算，会出现 NaN 时间戳。 */
    if (x.urg === undefined) x.urg = 0;
    if (x.imp === undefined) x.imp = 0;
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
