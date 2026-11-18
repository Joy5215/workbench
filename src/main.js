/* ---------- main.js ----------
   启动：读盘、首屏提示、悄悄看一眼远端、自动聚焦。 */

/* ---------- 启动 ---------- */
S = load();
document.getElementById('app').classList.toggle('mini', !!S.mini);
if (!CAN_SAVE) {
  var st0 = document.getElementById('st');
  if (st0) st0.textContent = '临时模式 · 关掉就没了';
  var dn = document.querySelector('.dot');
  if (dn) { dn.style.background = '#c08a2e'; }
}
// 跨天：隔夜回来，「今日」要是新的
var bootDay = dayKey();
setInterval(function(){
  if (dayKey() !== bootDay) { bootDay = dayKey(); render(); }
}, 60000);

/* 首屏无内容时给一条提示，避免"空白不知道干什么" */
render();

/* 上一次连着同步文件夹的话，悄悄看一眼远端有没有更新 */
setTimeout(autocheck, 900);

/* 输入框首次自动聚焦（桌面） */
if (window.innerWidth > 860 && S.view === 'today') {
  var i0 = document.getElementById('inp');
  if (i0 && !S.todos.length) setTimeout(function(){ i0.focus(); }, 120);
}
