/* ---------- views/quad.js ----------
   四象限：把同一批待办按「重要 × 紧急」切开。不是另一份数据，只是另一个视角。

   布局照滴答清单的实际界面：2×2 撑满屏、每格标题前面一个小色点、
   任务下面一行带日期、右下角一个悬浮 + 负责录入。
   不做的事：不铺整块彩色背景（滴答也没有），不显示任何说明文字。
*/

function quadOf(t){ return (t.urg ? 'u' : '-') + (t.imp ? 'i' : '-'); }

/* 任务行下面那行小字。今天就说「今天」，否则「11月20日」。 */
function quadWhen(t){
  var d = t.due ? new Date(t.due) : null;
  if (!d) return fmt(t.created);
  if (d.toDateString() === new Date().toDateString()) return '今天';
  return (d.getMonth()+1) + '月' + d.getDate() + '日';
}

/* 四象限里的一行：只有勾选框和两行文字，不放操作按钮——
   一排小按钮会把本来就窄的格子挤花，滴答也没有。 */
function quadRow(t){
  return '<div class="qrow" data-id="' + t.id + '">'
    + '<button class="cb" data-tog="' + t.id + '" aria-label="完成"></button>'
    + '<div class="qtx">'
    + '<div class="qt1">' + (t.star ? IC.pin : '') + esc(t.text) + '</div>'
    + '<div class="qt2">' + esc(quadWhen(t)) + '</div>'
    + '</div></div>';
}

function viewQuad(){
  var open = S.todos.filter(function(t){ return !t.del && !t.done; });
  var inboxN = S.inbox.filter(function(x){ return !x.del; }).length;

  var h = '<div class="qwrap">';

  /* 收集箱：滴答里它就在四象限上面，一条窄条。没东西时整条不出现。 */
  if (inboxN) {
    h += '<button class="qbar" data-inbox="1">'
      + '<span class="qbar-ic">' + IC.inbox + '</span>'
      + '<span class="qbar-t">收集箱</span>'
      + '<span class="qbar-n">' + inboxN + '</span></button>';
  }

  h += '<div class="quad">';

  QUADS.forEach(function(q){
    var items = open.filter(function(t){ return quadOf(t) === (q.urg ? 'u' : '-') + (q.imp ? 'i' : '-'); });
    items.sort(function(a,b){ return (b.star - a.star) || (b.created - a.created); });
    var on = S.addQuad === q.k;

    h += '<div class="qc" data-q="' + q.k + '" style="--qc:' + q.c + '">'
      + '<div class="qh"><i class="qd"></i><span class="qt">' + esc(q.label) + '</span>'
      + '<span class="qn">' + (items.length || '') + '</span></div>'
      + '<div class="qlist">' + items.map(quadRow).join('') + '</div>'
      + (on
          ? '<div class="qform"><input type="text" data-qin="' + q.k + '" placeholder="要做什么"'
            + ' autocomplete="off"><button class="qok" data-addq="' + q.k + '">添加</button></div>'
          : '')
      + '</div>';
  });

  h += '</div>';

  /* 右下角悬浮 +：跟滴答一样，点一下先选放进哪一格 */
  h += '<button class="fab" id="fab" aria-label="添加任务">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">'
    + '<path d="M12 5.6v12.8M5.6 12h12.8"/></svg></button>';

  return h + '</div>';
}

VIEW_FN.quad = viewQuad;
