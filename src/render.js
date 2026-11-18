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
      /* 输入法组字时按回车是在选字，不能当成提交 */
      var composing = e.isComposing || e.keyCode === 229;
      if (e.key !== 'Enter' || composing) return;
      /* Shift+Enter 换行：写长一点的笔记或粘贴后手动整理时要用 */
      if (e.shiftKey) return;
      e.preventDefault();
      submit();
    });

    /* 框自己长高：内容多了就多显示几行，最多 8 行，再多就滚动 */
    var autosize = function(){
      inp.style.height = 'auto';
      var h = Math.min(inp.scrollHeight, 160);
      inp.style.height = h + 'px';
    };
    inp.addEventListener('input', autosize);
    setTimeout(autosize, 0);

    var btn = document.getElementById('add');
    if (btn) btn.addEventListener('click', submit);
    bindPaste(inp, '');
    if (pendingFocus) { pendingFocus = false; setTimeout(function(){ inp.focus(); }, 0); }
  }

  /* 四象限格内输入框：不叫 inp（那个 id 是主输入框专用的），
     回车走 quadSubmit，才能带上这一格的标记。 */
  Array.prototype.forEach.call(document.querySelectorAll('[data-qin]'), function(box){
    box.addEventListener('keydown', function(e){
      if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        quadSubmit(box.dataset.qin);
      }
    });
    bindPaste(box, box.dataset.qin);
  });
  var qi = document.querySelector('[data-qin]');
  if (qi) setTimeout(function(){ qi.focus(); }, 0);


  bindSyncView();
  if (S.view === 'notes') bindNotes();
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
  /* 四象限要撑满屏、自己管滚动，所以把 .body 的 padding 与滚动交给 .qwrap */
  body.classList.toggle('qmode', S.view === 'quad');
  body.innerHTML = currentView();
  bindView();
  renderSheet();
  body.scrollTop = keep;

  /* 右下角 + 是每次渲染重建的，必须在这里绑；之前放在 bindView 里，
     而 bindView 在 DOM 换掉之前就跑了，拿到的是上一屏那个已废弃的节点。 */
  var fab = document.getElementById('fab');
  if (fab) fab.addEventListener('click', openFab);
}

/* ---------- 底部浮层：选象限 / 收集箱清理 ----------
   滴答点 + 之后先问「放进哪一格」，这里照做：四个象限按钮 + 一个收集箱按钮。
   收集箱清理也复用一个浮层，因为两者都是「从底部升起、选一下就走」。 */
function renderSheet(){
  var host = document.getElementById('sheet');
  if (!host) return;
  var h = '';

  if (S.picker) {
    h += '<div class="sh"><div class="sh-h">放到哪一格</div>';
    QUADS.forEach(function(q){
      h += '<button class="sh-b" data-pick="' + q.k + '">'
        + '<i class="qd" style="background:' + q.c + '"></i>' + esc(q.label) + '</button>';
    });
    h += '<button class="sh-b" data-pick="inbox">'
      + '<i class="qd qi">' + IC.inbox + '</i>收集箱</button>';
    h += '<button class="sh-x" data-close="1">取消</button></div>';
  }

  if (S.sheet === 'inbox') {
    var list = S.inbox.filter(function(x){ return !x.del; })
      .sort(function(a,b){ return b.created - a.created; });
    h += '<div class="sh"><div class="sh-h">收集箱 · ' + list.length + ' 条</div>';
    if (!list.length) {
      h += '<div class="sh-e">空的</div>';
    } else {
      h += '<div class="sh-list">' + list.map(function(x){
        return '<div class="sh-i"><div class="sh-t">' + esc(x.text) + '</div>'
          + '<div class="sh-a">'
          + QUADS.map(function(q){
              return '<button data-move="' + x.id + '" data-to="' + q.k + '"'
                + ' title="' + esc(q.label) + '"><i class="qd" style="background:' + q.c + '"></i></button>';
            }).join('')
          + '<button class="sh-del" data-del="' + x.id + '" title="删掉">' + IC.x + '</button>'
          + '</div></div>';
      }).join('') + '</div>';
    }
    h += '<div class="sh-x" data-close="1">收起</div></div>';
  }

  host.innerHTML = h;
  host.classList.toggle('on', !!h);
  var scrim = document.getElementById('sheet-scrim');
  if (scrim) scrim.classList.toggle('on', !!h);
}
