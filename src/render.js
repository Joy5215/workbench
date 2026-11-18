/* ---------- render.js ----------
   路由与装配：选视图、算导航数字、把 HTML 塞进 #body、绑一次性事件。

   加视图的流程：在 config.js 的 VIEWS 里注册 → 在 views/ 下写函数并
   VIEW_FN[k]=... 。这里不用改。
*/

function counts(){
  var open = 0, done = 0;
  S.todos.forEach(function(t){ if (t.del) return; t.done ? done++ : open++; });
  var ib = 0;
  S.inbox.forEach(function(t){ if (!t.del) ib++; });
  return {open:open, done:done, inbox:ib};
}

/* 导航上的角标。返回空串就不显示。 */
function navBadge(k, c){
  if (k === 'today') return c.open > 0 ? String(c.open) : '';
  if (k === 'inbox') return c.inbox > 0 ? String(c.inbox) : '';
  return '';
}

function renderNav(){
  var c = counts();
  document.getElementById('nav').innerHTML = VIEWS.map(function(v){
    return '<button class="nav' + (S.view === v.k ? ' on' : '') + '" data-view="' + v.k + '">'
      + (IC[v.ic] || '') + '<span class="lb">' + v.label + '</span>'
      + '<span class="cnt">' + navBadge(v.k, c) + '</span></button>';
  }).join('');

  var cur = VIEWS.filter(function(v){ return v.k === S.view; })[0] || VIEWS[0];
  document.getElementById('crumb').textContent = '/ ' + cur.label;
  document.title = cur.label + ' · 我的工作台';
}

/* 只给当前视图绑事件。每次 render 后 DOM 是新的，绑旧的会泄漏。 */
var pendingFocus = false;

function bindView(){
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
    if (pendingFocus) { pendingFocus = false; setTimeout(function(){ inp.focus(); }, 0); }
  }

  /* 四象限每格一个输入框，它们不叫 inp（那个 id 是主输入框专用的）。
     回车走 quadSubmit，才能带上这一格的标记。 */
  Array.prototype.forEach.call(document.querySelectorAll('[data-qin]'), function(box){
    box.addEventListener('keydown', function(e){
      if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        quadSubmit(box.dataset.qin);
      }
    });
  });

  bindSyncView();
}

function currentView(){
  var fn = VIEW_FN[S.view];
  if (fn) return fn();
  if (S.view === 'sync') return viewSync();
  return viewSoon(S.view);
}

function render(opts){
  opts = opts || {};
  if (opts.focus) pendingFocus = true;
  renderNav();
  var body = document.getElementById('body');
  var keep = opts.top ? 0 : body.scrollTop;
  body.innerHTML = currentView();
  bindView();
  body.scrollTop = keep;
}
