/* ---------- ui.js ----------
   组件层：能被两个以上视图复用的 HTML 片段。只有这里允许出现「长得一样」的东西。
   参数一律传值，不读全局 S —— 这样组件本身可以被单独测。 */

/* 页面标题 + 副标题 */
function uiHead(title, sub){
  return '<h1 class="page-h">' + esc(title) + '</h1>'
    + '<div class="page-s">' + sub + '</div>';
}

/* 输入行。id 固定为 inp / add，actions.js 靠这两个 id 取值。 */
function uiEntry(placeholder, btnText){
  return '<div class="entry"><input id="inp" type="text" placeholder="' + esc(placeholder) + '"'
    + ' autocomplete="off"><button class="b" id="add">' + esc(btnText || '添加') + '</button></div>';
}

/* 空状态：一个图标 + 两句解释 */
function uiEmpty(icon, t1, t2){
  var ic = IC[icon] || '';
  return '<div class="empty"><div class="ic">' + ic + '</div>'
    + '<div class="t1">' + esc(t1) + '</div><div class="t2">' + t2 + '</div></div>';
}

/* 分组小标题，右侧拉一条线 */
function uiGroup(text, extra){
  return '<div class="grp">' + esc(text) + (extra || '') + '</div>';
}

/* 统计卡。n 是数字，k 是标签，hot 让数字用强调色 */
function uiStat(n, k, hot){
  return '<div class="stat' + (hot ? ' hot' : '') + '"><div class="n">' + esc(String(n)) + '</div>'
    + '<div class="k">' + esc(k) + '</div></div>';
}

/* 「这一版先不做」的说明块 */
function uiSoon(t1, t2){
  return '<div class="soon"><div class="t1">' + esc(t1) + '</div>'
    + '<div class="t2">' + (t2 || '') + '</div></div>';
}

/* 页脚小字 */
function uiFoot(text){
  return '<div class="foot-note">' + text + '</div>';
}

/* 分段控件（三选一之类）。items: [{k, label, n}]，active 是当前 k。
   data 前缀决定事件怎么认：data-seg="<组名>" + data-k="<值>"。 */
function uiSeg(name, items, active){
  return '<div class="seg">' + items.map(function(it){
    return '<button class="sg' + (it.k === active ? ' on' : '') + '"'
      + ' data-seg="' + esc(name) + '" data-k="' + esc(it.k) + '">'
      + esc(it.label) + (it.n ? '<i>' + esc(String(it.n)) + '</i>' : '') + '</button>';
  }).join('') + '</div>';
}
