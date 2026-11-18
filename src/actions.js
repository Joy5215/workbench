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
    S.todos.push({id:uid(), text:v, done:false, doneAt:0, star:star, created:now, up:now, del:0});
  }
  save();
  render({focus:true, top:true});
}

function findTodo(id){
  for (var i=0;i<S.todos.length;i++) if (S.todos[i].id === id) return S.todos[i];
  return null;
}

document.addEventListener('click', function(e){
  var t = e.target.closest ? e.target.closest('[data-view],[data-tog],[data-star],[data-del],[data-conv]') : null;

  if (t && t.dataset.view) {
    S.view = t.dataset.view;
    document.getElementById('app').classList.remove('drawer');
    save(); render({top:true});
    return;
  }
  if (t && t.dataset.tog) {
    var todo = findTodo(t.dataset.tog);
    if (todo) {
      todo.done = !todo.done;
      todo.doneAt = todo.done ? Date.now() : 0;
      todo.up = Date.now();
      save(); render();
    }
    return;
  }
  if (t && t.dataset.star) {
    var td = findTodo(t.dataset.star);
    if (td) { td.star = !td.star; td.up = Date.now(); save(); render(); }
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
      S.todos.push({id:uid(), text:item.text, done:false, doneAt:0, star:false, created:tnow, up:tnow, del:0});
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
