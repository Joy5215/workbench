/* ---------- views/today.js ----------
   今日：所有未完成的事一屏看完，重点排前面。
   数据来源仍是一条 flat 待办列表（v1 的语义），四象限只是它的另一个视角。 */

/* 待办行的通用渲染。四象限 / 今日 / 清单视图共用，放这里而不是 ui.js，
   因为它依赖 IC 与 fmt 的组合语义太多，抽成通用组件反而难读。 */
function todoRow(t, opt){
  opt = opt || {};
  var meta = '<div class="meta">'
    + (t.done ? ('完成于 ' + fmt(t.doneAt)) : fmt(t.created));

  /* 四象限标记：两个小点，有标记才亮 */
  var marks = '';
  if (t.imp) marks += '<span class="tag imp">重要</span>';
  if (t.urg) marks += '<span class="tag urg">紧急</span>';
  if (marks) meta += '<span class="mk">' + marks + '</span>';
  meta += '</div>';

  var acts = '<div class="act">'
    + '<button data-urg="' + t.id + '" class="' + (t.urg ? 'on u' : '') + '"'
    + ' title="' + (t.urg ? '取消紧急' : '标记紧急') + '">急</button>'
    + '<button data-imp="' + t.id + '" class="' + (t.imp ? 'on i' : '') + '"'
    + ' title="' + (t.imp ? '取消重要' : '标记重要') + '">重</button>'
    + '<button class="del" data-del="' + t.id + '" title="删除">' + IC.x + '</button></div>';

  return '<div class="row" data-id="' + t.id + '">'
    + '<button class="cb' + (t.done ? ' done' : '') + '" data-tog="' + t.id + '" aria-label="完成"></button>'
    + '<div class="tx"><div class="t' + (t.done ? ' done' : '') + '">'
    + (t.star ? IC.pin : '') + esc(t.text) + '</div>' + meta + '</div>'
    + acts + '</div>';
}

/* 收件箱行：没有勾选框，只有「转待办」和「删」 */
function inboxRow(t){
  return '<div class="row inb"><div class="tx">'
    + '<div class="t">' + esc(t.text) + '</div>'
    + '<div class="meta">' + fmt(t.created) + '</div></div>'
    + '<div class="act">'
    + '<button class="ox" data-conv="' + t.id + '" title="转成待办">转待办</button>'
    + '<button class="del" data-del="' + t.id + '" title="删掉">' + IC.x + '</button></div></div>';
}

function viewToday(){
  var live = S.todos.filter(function(t){ return !t.del; });
  var open = live.filter(function(t){ return !t.done; });
  var done = live.filter(function(t){ return t.done; });
  open.sort(function(a,b){ return (b.star - a.star) || (b.created - a.created); });
  done.sort(function(a,b){ return (b.doneAt || 0) - (a.doneAt || 0); });

  var h = '<div class="wrap">' + uiHead('今日', todayLine())
    + uiEntry('添加一件事… 以 ! 开头可标为重点', '添加');

  if (open.length) {
    h += '<div class="list">' + open.map(function(t){ return todoRow(t, {}); }).join('') + '</div>';
  } else if (!done.length) {
    h += '<div class="list">' + uiEmpty('today', '今天还没有事',
      '在上面输入框写一件，按 <kbd>Enter</kbd> 就行。先只写一件，别列清单。') + '</div>';
  }

  if (done.length) {
    h += uiGroup('已完成 ' + done.length)
      + '<div class="list">' + done.map(function(t){ return todoRow(t, {}); }).join('') + '</div>';
  }

  h += uiFoot(CAN_SAVE
    ? '数据存在这台设备的浏览器里，不上传。想换设备用「导出」带走。'
    : '当前预览环境不允许本地存储，数据只在这个窗口里有效。用「导出」可以拿走。');
  return h + '</div>';
}

VIEW_FN.today = viewToday;
