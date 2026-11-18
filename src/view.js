/* ---------- view.js ----------
   渲染层：只读 S 和本地变量，产 HTML 字符串。所有用户输入都过 esc()。 */

/* ---------- 渲染 ---------- */
function counts(){
  var open = 0, done = 0;
  S.todos.forEach(function(t){ if (t.del) return; t.done ? done++ : open++; });
  var ib = 0;
  S.inbox.forEach(function(t){ if (!t.del) ib++; });
  return {open:open, done:done, inbox:ib};
}

function renderNav(){
  var c = counts();
  var html = '';
  VIEWS.forEach(function(v){
    var n = '';
    if (v.k === 'today') n = c.open > 0 ? String(c.open) : '';
    if (v.k === 'inbox') n = c.inbox > 0 ? String(c.inbox) : '';
    html += '<button class="nav' + (S.view === v.k ? ' on' : '') + '" data-view="' + v.k + '">'
      + IC[v.ic] + '<span class="lb">' + v.label + '</span><span class="cnt">' + n + '</span></button>';
  });
  document.getElementById('nav').innerHTML = html;
  var cur = VIEWS.filter(function(v){ return v.k === S.view; })[0] || VIEWS[0];
  document.getElementById('crumb').textContent = '/ ' + cur.label;
  document.title = cur.label + ' · 我的工作台';
}

function rowHtml(t, isInbox){
  var meta = '';
  if (isInbox) {
    meta = '<div class="meta">' + fmt(t.created) + '</div>';
  } else {
    meta = '<div class="meta">'
      + (t.doneAt ? ('完成于 ' + fmt(t.doneAt)) : fmt(t.created))
      + '</div>';
  }
  var acts = '';
  if (isInbox) {
    acts = '<div class="act">'
      + '<button class="ox" data-conv="' + t.id + '" title="转成待办">转待办</button>'
      + '<button class="del" data-del="' + t.id + '" title="删掉">' + IC.x + '</button></div>';
  } else {
    acts = '<div class="act">'
      + '<button data-star="' + t.id + '" class="' + (t.star ? 'on' : '') + '" title="' + (t.star ? '取消重点' : '标为重点') + '">' + (t.star ? IC.starOn : IC.starOff) + '</button>'
      + '<button class="del" data-del="' + t.id + '" title="删除">' + IC.x + '</button></div>';
  }
  return '<div class="row' + (isInbox ? ' inb' : '') + '">'
    + (isInbox ? '' : '<button class="cb' + (t.done ? ' done' : '') + '" data-tog="' + t.id + '" aria-label="完成"></button>')
    + '<div class="tx"><div class="t' + (t.done ? ' done' : '') + '">' + (t.star ? IC.pin : '') + esc(t.text) + '</div>' + meta + '</div>'
    + acts + '</div>';
}

function emptyHtml(icon, t1, t2){
  return '<div class="empty"><div class="ic">' + IC[icon] + '</div>'
    + '<div class="t1">' + t1 + '</div><div class="t2">' + t2 + '</div></div>';
}

function viewToday(){
  var live = S.todos.filter(function(t){ return !t.del; });
  var open = live.filter(function(t){ return !t.done; });
  var done = live.filter(function(t){ return t.done; });
  open.sort(function(a,b){ return (b.star - a.star) || (b.created - a.created); });
  done.sort(function(a,b){ return (b.doneAt || 0) - (a.doneAt || 0); });

  var h = '<div class="wrap"><h1 class="page-h">今日</h1>'
    + '<div class="page-s">' + todayLine() + '</div>'
    + '<div class="entry"><input id="inp" type="text" placeholder="添加一件事… 以 ! 开头可标为重点" autocomplete="off"><button class="b" id="add">添加</button></div>';

  if (open.length) {
    h += '<div class="list">' + open.map(function(t){ return rowHtml(t, false); }).join('') + '</div>';
  } else if (!done.length) {
    h += emptyHtml('today', '今天还没有事', '在上面输入框写一件，按 <kbd>Enter</kbd> 就行。先只写一件，别列清单。');
  }

  if (done.length) {
    h += '<div class="grp">已完成 ' + done.length + '</div><div class="list">'
      + done.map(function(t){ return rowHtml(t, false); }).join('') + '</div>';
  }

  h += '<div class="foot-note">' + (CAN_SAVE
      ? '数据存在这台设备的浏览器里，不上传。想换设备用「导出」带走。'
      : '当前预览环境不允许本地存储，数据只在这个窗口里有效。用「导出」可以拿走。')
    + '</div></div>';
  return h;
}

function viewInbox(){
  var list = S.inbox.filter(function(x){ return !x.del; })
    .sort(function(a,b){ return b.created - a.created; });
  var h = '<div class="wrap"><h1 class="page-h">收件箱</h1>'
    + '<div class="page-s">' + (list.length ? list.length + ' 条待清理 · 想到什么先丢进来' : '想到什么先丢进来，不用当时就决定') + '</div>'
    + '<div class="entry"><input id="inp" type="text" placeholder="记一笔…" autocomplete="off"><button class="b" id="add">记下</button></div>';

  if (list.length) {
    h += '<div class="list">' + list.map(function(t){ return rowHtml(t, true); }).join('') + '</div>';
  } else {
    h += emptyHtml('inbox', '收件箱是空的', '这里是「先接住，回头再理」的地方。写一句就够，不必完整。');
  }
  h += '<div class="foot-note">清理节奏：每条只有两个出路——变成待办，或者删掉。别让它堆成第二份待办。</div></div>';
  return h;
}

function viewReview(){
  var now = Date.now();
  var ws = weekStart();
  var doneToday = S.todos.filter(function(t){
    return !t.del && t.done && t.doneAt && new Date(t.doneAt).toDateString() === new Date().toDateString();
  }).length;
  var doneWeek = S.todos.filter(function(t){ return !t.del && t.done && t.doneAt && t.doneAt >= ws; }).length;
  var inboxOpen = S.inbox.filter(function(x){ return !x.del; }).length;
  var h = '<div class="wrap"><h1 class="page-h">回顾</h1>'
    + '<div class="page-s">不追数字，只看积压有没有在涨</div>'
    + '<div class="stats">'
    + '<div class="stat hot"><div class="n">' + doneToday + '</div><div class="k">今天完成</div></div>'
    + '<div class="stat"><div class="n">' + doneWeek + '</div><div class="k">本周完成</div></div>'
    + '<div class="stat"><div class="n">' + inboxOpen + '</div><div class="k">收件箱积压</div></div>'
    + '</div>';
  h += '<div class="soon"><div class="t1">这一版只有这三个数</div>'
    + '<div class="t2">下一版会加：连续完成天数、每条待办从记下到完成用了多久、以及「积压超过 7 天的条目」自动浮出来。<b>现在先不加</b>——数字多了就没人看了。</div></div>';
  h += '</div>';
  return h;
}

function viewSoon(kind){
  var cfg = {
    projects:{h:'项目', s:'把待办归到项目下，按项目看进度', ic:'folder',
      next:'项目 = 一组相关待办的容器。你可能想：「Q4 复盘」下面挂 5 件事，做完 3 件就显示 60%。'},
    notes:{h:'笔记', s:'比待办长、比文档短的东西', ic:'note',
      next:'和收件箱的区别：收件箱是「还没想清楚的一句话」，笔记是「已经想清楚、要留存的一段」。合并、打标签、全文搜索都在这一版之后。'}
  }[kind];
  return '<div class="wrap"><h1 class="page-h">' + cfg.h + '</h1>'
    + '<div class="page-s">' + cfg.s + '</div>'
    + '<div class="soon"><div class="t1">这一版先不做</div>'
    + '<div class="t2">' + cfg.next + '<br><br>先让你把「今日 + 收件箱」用起来。这两块跑顺了，才知道' + cfg.h + '该长什么样——现在做，只能靠我猜。</div></div></div>';
}

function render(opts){
  opts = opts || {};
  renderNav();
  var body = document.getElementById('body');
  var keep = opts.top ? 0 : body.scrollTop;
  var html = '';
  if (S.view === 'today') html = viewToday();
  else if (S.view === 'inbox') html = viewInbox();
  else if (S.view === 'review') html = viewReview();
  else if (S.view === 'sync') html = viewSync();
  else html = viewSoon(S.view);
  body.innerHTML = html;

  var inp = document.getElementById('inp');
  if (inp) {
    inp.addEventListener('keydown', function(e){
      if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        submit();
      }
    });
    var btn = document.getElementById('add');
    if (btn) btn.addEventListener('click', submit);
    if (opts.focus) setTimeout(function(){ inp.focus(); }, 0);
  }

  /* 同步页的按钮不走事件委托，单独绑 */
  var bPick = document.getElementById('pick');
  if (bPick) bPick.addEventListener('click', pickFolder);
  var bSyn = document.getElementById('syn');
  if (bSyn) bSyn.addEventListener('click', function(){ syncNow('full'); });
  var bUp = document.getElementById('synup');
  if (bUp) bUp.addEventListener('click', function(){ syncNow('up'); });
  var bDown = document.getElementById('syndown');
  if (bDown) bDown.addEventListener('click', function(){ syncNow('down'); });
  var bForget = document.getElementById('forget');
  if (bForget) bForget.addEventListener('click', forgetFolder);
  var bRe = document.getElementById('reauth');
  if (bRe) bRe.addEventListener('click', function(){
    if (!syncHandle) return;
    permOf(syncHandle, true).then(function(p){
      SY.perm = p;
      if (p === 'granted') { toast('权限已恢复'); autocheck(); }
      else { toast('浏览器还是没给权限'); render({}); }
    });
  });

  body.scrollTop = keep;
}
