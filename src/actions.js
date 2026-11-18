/* ---------- actions.js ----------
   写操作：增删改、导入导出、事件委托。删一律留墓碑，不真删。 */

/* ---------- 动作 ---------- */
function submit(){
  var inp = document.getElementById('inp');
  if (!inp) return;
  var v = inp.value.trim();
  if (!v) return;

  var now = Date.now();
  if (S.view === 'inbox') {
    S.inbox.push({id:uid(), text:v, created:now, up:now, del:0});
  } else {
    var star = false;
    if (/^[!！]/.test(v)) { star = true; v = v.replace(/^[!！]\s*/, ''); }
    if (!v) return;
    S.todos.push({id:uid(), text:v, done:false, doneAt:0, star:star,
                  urg:0, imp:0, created:now, up:now, del:0});
  }
  save();
  render({focus:true, top:true});
}

/* ---------- 粘贴多行：每行一条 ----------
   从飞书、备忘录、微信里复制一串待办，粘进来直接变成 N 条。
   飞书的编辑器本身嵌不进来（X-Frame-Options: DENY + 第三方 cookie 限制），
   但它的**产出**可以喂进来——这是「在别处写、在这里变成结构」唯一能真做到的形态。

   顺手吃掉常见的前缀：`- ` `* ` `1. ` `[ ] ` `[x] `，留着它们当任务名很难看。 */
/* 把一段多行文本洗干净：拆行、去掉列表前缀、丢空行。
   `- 买牛奶` `* 买牛奶` `1. 买牛奶` `[ ] 买牛奶` 在这个输入框里都只是「买牛奶」。 */
function cleanLines(text){
  return String(text || '').split(/\r?\n/).map(function(line){
    return line
      .replace(/^\s*[-*+•]\s+/, '')
      .replace(/^\s*\d+[.)]\s+/, '')
      .replace(/^\s*\[[ xX]?\]\s*/, '')
      .trim();
  }).filter(function(x){ return !!x; });
}

/* opt.quad 指定格子（为空则按 opt.inbox 决定去收集箱还是普通待办） */
function addMany(lines, opt){
  opt = opt || {};
  var q = opt.quad && QUAD_BY[opt.quad] ? QUAD_BY[opt.quad] : null;
  var now = Date.now();
  var n = 0;

  lines.forEach(function(t){
    var star = false;
    if (/^[!！]/.test(t)) { star = true; t = t.replace(/^[!！]\s*/, ''); }
    if (!t) return;

    if (!q && opt.inbox) {
      S.inbox.push({id:uid(), text:t, created:now, up:now, del:0});
    } else {
      S.todos.push({id:uid(), text:t, done:false, doneAt:0, star:star,
                    urg:q ? q.urg : 0, imp:q ? q.imp : 0, created:now, up:now, del:0});
    }
    n++;
  });
  if (n) save();
  return n;
}

/* 粘贴多行：至少两行才拦，单行留给浏览器默认行为 */
function pasteLines(text, quadKey){
  var lines = cleanLines(text);
  if (lines.length < 2) return 0;
  return addMany(lines, { quad: quadKey, inbox: !quadKey && S.view === 'inbox' });
}

/* ---------- URL 入口：?add=… ----------
   这是「接别处的东西进来」最通用的一刀：
     iOS 快捷指令分享任何文本 → 打开这个链接 → 直接进收集箱
     安卓任何 App 「分享 → 复制」再用桌面快捷方式打开同样有效
     桌面浏览器可以用书签小工具拼这个 URL
   带上 &to=do|plan|deleg|drop 就直接落进那一格。
   收完立刻把 query 擦掉，否则刷新一次就重复入库一次。 */
function catchUrlAdd(){
  try {
    var p = new URLSearchParams(location.search);
    var txt = p.get('add') || p.get('t') || p.get('text') || '';
    if (!txt) return;

    var to = (p.get('to') || '').trim();
    var lines = cleanLines(txt);
    /* 没指定格子就进收集箱 —— 这是「收集」这个词的字面意思，
       先收下，回头再决定放哪一格。 */
    var n = addMany(lines, { quad: to, inbox: !to });

    /* 不管有没有加成功，query 都得清掉 */
    history.replaceState(null, '', location.pathname + location.hash);

    if (!n) { toast('链接里没有可用的内容'); return; }
    if (!to && S.view !== 'inbox') { S.view = 'inbox'; save(); }
    render({top:true});
    toast('收到 ' + n + ' 条');
  } catch(e){}
}

/* 给一个输入框挂上「多行粘贴自动拆条」。quadKey 为空表示这是主输入框。 */
function bindPaste(el, quadKey){
  el.addEventListener('paste', function(e){
    var cd = e.clipboardData;
    if (!cd) return;

    var files = cd.files;
    if (files && files.length) {
      var img = Array.prototype.filter.call(files, function(f){ return /^image\//.test(f.type); })[0];
      if (img) { e.preventDefault(); toast('图片先存不了，只收文字'); return; }
    }

    var text = cd.getData('text/plain');
    /* 单行交给浏览器默认行为，不要拦——拦了反而粘贴不了长句 */
    if (!text || text.indexOf('\n') < 0) return;

    var n = pasteLines(text, quadKey);
    if (!n) return;
    e.preventDefault();
    render({top:true});
    setTimeout(function(){
      var again = quadKey ? document.querySelector('[data-qin="' + quadKey + '"]')
                          : document.getElementById('inp');
      if (again) { again.value = ''; again.focus(); }
    }, 0);
    toast('粘进来 ' + n + ' 条');
  });
}

/* 象限内联添加：输入框在该格里，提交时直接带上这一格的 urg/imp。
   注意不能复用 submit()——那个靠 S.view 判断往 todos 还是 inbox 里塞，
   在四象限页会把事塞进收件箱。这里必须自己写。 */
function quadSubmit(k){
  var box = document.querySelector('.qc[data-q="' + k + '"]');
  if (!box) return;
  var inp = box.querySelector('input');
  var v = inp ? inp.value.trim() : '';
  if (!v) { if (inp) inp.focus(); return; }
  var q = QUAD_BY[k];
  var now = Date.now();
  var star = false;
  if (/^[!！]/.test(v)) { star = true; v = v.replace(/^[!！]\s*/, ''); }
  if (!v) return;
  S.todos.push({id:uid(), text:v, done:false, doneAt:0, star:star,
                urg:q.urg, imp:q.imp, created:now, up:now, del:0});
  /* 连着记几件事时不要把输入框收掉；只有点「添加」才收 */
  save(); render();
  var again = document.querySelector('.qc[data-q="' + k + '"] input');
  if (again) again.focus();
}

/* 点右下角 + → 先问放进哪一格。滴答也是这个流程。 */
function openFab(){
  S.picker = true;
  renderSheet();
}

/* 选中格子后，把这一格切到「可录入」状态，输入框自动聚焦 */
function pickQuad(k){
  S.picker = false;
  if (k === 'inbox') {
    S.sheet = 'inbox';
    renderSheet();
    return;
  }
  S.addQuad = (S.addQuad === k) ? '' : k;
  save(); render();
}

/* 收集箱条目直接归到某一格：原地改标记，换到 todos 里，收集箱那条留墓碑 */
function moveToQuad(id, k){
  var item = null;
  S.inbox.forEach(function(x){ if (x.id === id && !x.del) item = x; });
  if (!item) return;
  var q = QUAD_BY[k];
  item.del = 1;
  bumpUp(item);
  var now = Date.now();
  S.todos.push({id:uid(), text:item.text, done:false, doneAt:0, star:false,
                urg:q.urg, imp:q.imp, created:now, up:now, del:0});
  save(); render();
  toast('已放进「' + q.label + '」');
}

function findTodo(id){
  for (var i=0;i<S.todos.length;i++) if (S.todos[i].id === id) return S.todos[i];
  return null;
}

/* 行内加在某个象限后，容器变窄，只留「取消象限标记」和「删」；勾选框留着。 */
document.addEventListener('click', function(e){
  var t = e.target.closest ? e.target.closest(
    '[data-view],[data-tog],[data-star],[data-del],[data-conv],[data-urg],[data-imp],[data-addq]'
    + ',[data-pick],[data-inbox],[data-move],[data-close]') : null;

  if (!t) return;

  if (t.dataset.close) {
    S.picker = false; S.sheet = '';
    renderSheet();
    return;
  }
  if (t.dataset.pick) { pickQuad(t.dataset.pick); return; }
  if (t.dataset.inbox) { S.sheet = 'inbox'; save(); renderSheet(); return; }
  if (t.dataset.move) { moveToQuad(t.dataset.move, t.dataset.to); return; }

  if (t && t.dataset.view) {
    S.view = t.dataset.view;
    document.getElementById('app').classList.remove('drawer');
    save(); render({top:true});
    return;
  }
  if (t && t.dataset.addq) {
    quadSubmit(t.dataset.addq);
    return;
  }
  if (t && t.dataset.urg) {
    var tu = findTodo(t.dataset.urg);
    if (tu) { tu.urg = tu.urg ? 0 : 1; bumpUp(tu); save(); render(); }
    return;
  }
  if (t && t.dataset.imp) {
    var ti = findTodo(t.dataset.imp);
    if (ti) { ti.imp = ti.imp ? 0 : 1; bumpUp(ti); save(); render(); }
    return;
  }
  if (t && t.dataset.tog) {
    var todo = findTodo(t.dataset.tog);
    if (todo) {
      todo.done = !todo.done;
      todo.doneAt = todo.done ? Date.now() : 0;
      bumpUp(todo);
      save(); render();
    }
    return;
  }
  if (t && t.dataset.star) {
    var td = findTodo(t.dataset.star);
    if (td) { td.star = !td.star; bumpUp(td); save(); render(); }
    return;
  }
  if (t && t.dataset.del) {
    var id = t.dataset.del;
    var gone = null;
    S.todos.concat(S.inbox).forEach(function(x){ if (x.id === id) gone = x; });
    if (!gone) return;
    /* 不真删，留墓碑。真删了另一台设备一同步就把它复活了。 */
    gone.del = 1;
    bumpUp(gone);
    save(); render();
    var brief = gone.text.length > 14 ? gone.text.slice(0,14) + '…' : gone.text;
    toast('已删除「' + brief + '」', function(){
      gone.del = 0;
      bumpUp(gone);
      save(); render();
    });
    return;
  }
  if (t && t.dataset.conv) {
    var id2 = t.dataset.conv;
    var item = null;
    S.inbox.forEach(function(x){ if (x.id === id2) item = x; });
    if (item) {
      item.del = 1;
      bumpUp(item);
      var tnow = Date.now();
      S.todos.push({id:uid(), text:item.text, done:false, doneAt:0, star:false,
                    urg:0, imp:0, created:tnow, up:tnow, del:0});
    }
    save(); render();
    return;
  }
});

document.getElementById('burger').addEventListener('click', function(){
  document.getElementById('app').classList.add('drawer');
});
document.getElementById('scrim').addEventListener('click', function(){
  document.getElementById('app').classList.remove('drawer');
});
document.getElementById('sheet-scrim').addEventListener('click', function(){
  S.picker = false; S.sheet = '';
  renderSheet();
});
document.getElementById('fold').addEventListener('click', function(){
  S.mini = !S.mini;
  document.getElementById('app').classList.toggle('mini', S.mini);
  save();
});
document.getElementById('undo').addEventListener('click', function(){
  var fn = toastFn;
  hideToast();
  if (fn) fn();
});
document.getElementById('exp').addEventListener('click', function(){
  var data = JSON.stringify({v:1, exportedAt:new Date().toISOString(), todos:S.todos, inbox:S.inbox}, null, 2);
  var blob = new Blob([data], {type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '我的工作台-' + dayKey() + '.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('已导出 JSON，文件在下载目录里');
});

/* 导入：不覆盖，走 mergeInto 逐条比 up。导错文件不会把现有数据弄丢。 */
document.getElementById('imp').addEventListener('click', function(){
  document.getElementById('impfile').click();
});
document.getElementById('impfile').addEventListener('change', function(e){
  var f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f) return;
  f.text().then(function(txt){
    var d;
    try { d = JSON.parse(txt); } catch(err){ throw new Error('不是合法的 JSON'); }
    if (!d || (!Array.isArray(d.todos) && !Array.isArray(d.inbox))) {
      throw new Error('里面没有 todos / inbox 这两个数组');
    }
    var st = mergeInto({ todos: d.todos || [], inbox: d.inbox || [] });
    save(); render();
    toast('已合并：新增 ' + st.add + ' · 更新 ' + st.upd
      + (st.tomb ? ' · 删除 ' + st.tomb : '') + ' · 未变 ' + st.same);
  }).catch(function(err){
    toast('导入失败：' + (err.message || '文件读不出来'));
  });
});
