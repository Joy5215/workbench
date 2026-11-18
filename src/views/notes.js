/* ---------- views/notes.js ----------
   笔记：一条笔记 = 一个来源（视频 / 图片 / 飞书文档 / WPS 文档）+ 一段 Markdown。

   为什么不做成「富文本编辑器」：
   富文本要一个能处理光标、选区的编辑器，几万行起步，而且存下来的 HTML 跨版本难兼容。
   Markdown 是纯文本，能进同步文件、能 diff、能在手机上用软键盘改，代价是要认几个符号。
   考虑到这里面大量内容是「贴个视频 + 写两句」，Markdown 够用。

   出处：用户 21:17「喜欢飞书能嵌入视频，喜欢 wps 有思维导图、markdown 文件读取」。
   这两条在网页里都能做到 —— 视频靠官方 iframe，思维导图靠 mermaid 文本，
   Markdown 靠一个 35KB 的解析器。都不是飞书或 WPS 的专利。 */

function notesLive(){
  return (S.notes || []).filter(function(x){ return !x.del; })
    .sort(function(a, b){ return (b.up || b.created) - (a.up || a.created); });
}

function noteCard(n){
  var h = '<div class="nt" data-note="' + esc(n.id) + '">';
  if (n.text) h += '<div class="nt-h">' + esc(n.text) + '</div>';

  /* 来源块：视频/图片/外站卡片，走 media.js */
  if (n.src) h += mediaBlock({ src: n.src, text: '' });

  /* 正文按 Markdown 渲染，mermaid 代码块单独换成图 */
  if (n.body && n.body.trim()) {
    var body = n.body;
    /* 先把 ```mermaid 块摘出来，渲染成图片，再整体走 Markdown */
    body = body.replace(/```mermaid\s*\n([\s\S]*?)```/g, function(_, code){
      var id = 'mm' + Math.random().toString(36).slice(2, 8);
      /* 图床是第三方，哪天挂了就是一张空白 —— 所以带上 onerror 兜底，
         并在图下面一直保留源码。图挂了至少还能看到画的是什么。 */
      return '\n<div class="mmm">'
        + '<img src="' + esc(mermaidSrc(code.trim())) + '" alt="图" loading="lazy"'
        + ' onerror="this.parentNode.classList.add(\'bad\')">'
        + '<div class="mmm-e">图没加载出来（断网或图床挂了），下面是源码</div>'
        + '<div class="mmm-c"><pre>' + esc(code.trim()) + '</pre></div></div>\n';
    });
    h += '<div class="nt-body md">' + mdRender(body) + '</div>';
  }

  h += '<div class="nt-f"><span class="nt-t">' + fmt(n.up || n.created) + '</span>'
    + '<button class="nt-b" data-note-edit="' + esc(n.id) + '">改</button>'
    + '<button class="nt-b nt-x" data-note-del="' + esc(n.id) + '">删</button></div>';
  h += '</div>';
  return h;
}

function viewNotes(){
  var list = notesLive();
  var editing = S.noteEdit;

  var h = '<div class="wrap"><h1 class="page-h">笔记</h1>'
    + '<div class="page-s">' + (list.length ? list.length + ' 条' : '还没有') + '</div>';

  /* 编辑区：新建或改一条 */
  if (editing) {
    var n = editing === 'new' ? null : (S.notes || []).filter(function(x){ return x.id === editing; })[0];
    h += '<div class="nted">'
      + '<div class="nted-r"><span>标题</span><input id="nttitle" placeholder="可留空"'
      + ' autocomplete="off" value="' + esc(n && n.text ? n.text : '') + '"></div>'
      + '<div class="nted-r"><span>来源</span><input id="ntsrc" placeholder="粘贴视频/文档链接，可留空"'
      + ' autocomplete="off" spellcheck="false" value="' + esc(n && n.src ? n.src.url : '') + '"></div>'
      + '<div class="nted-r"><span>正文</span><textarea id="ntbody" rows="6" placeholder="Markdown。&#10;```mermaid 开头的一段会画成图"'
      + ' spellcheck="false">' + esc(n ? (n.body || '') : '') + '</textarea></div>'
      + '<div class="btnrow"><button class="primary" id="ntsave">保存</button>'
      + '<button id="ntcancel">取消</button></div></div>';
  } else {
    h += '<div class="btnrow" style="margin:0 0 4px"><button class="primary" id="ntnew">写一条</button>'
      + '<button id="ntimp">读 md</button>'
      + '<input type="file" id="ntfile" accept=".md,.markdown,.txt,text/markdown,text/plain" multiple hidden></div>';
  }

  if (!list.length && !editing) {
    h += '<div class="nempty">粘一个视频链接进来，它会存成一条笔记</div>';
  } else if (!editing || editing !== 'new') {
    h += list.map(noteCard).join('');
  }

  return h + '</div></div>';
}

/* ---------- 读 Markdown 文件 ----------
   一条 md 文件 = 一条笔记。`---` 之间的元信息认得 title / date，其余忽略。
   分批入库而不是一次性 push：几百个文件一起塞进去会把主线程卡死几秒，
   中途失败也不该一条都不剩。 */
function importMdFiles(files){
  var arr = Array.prototype.slice.call(files || []);
  if (!arr.length) return;

  var ok = 0, skip = 0;

  var readOne = function(i){
    if (i >= arr.length) {
      save(); render({top:true});
      toast(skip ? '读入 ' + ok + ' 个，跳过 ' + skip + ' 个（不是 .md）' : '读入 ' + ok + ' 个文件');
      return;
    }
    var f = arr[i];
    if (!/\.(md|markdown|mdown|txt)$/i.test(f.name)) { skip++; readOne(i + 1); return; }

    var fr = new FileReader();
    fr.onload = function(){
      var raw = String(fr.result || '');
      var title = f.name.replace(/\.[^.]+$/, '');
      var body = raw;

      /* 开头的 --- ... --- 里找 title */
      var fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
      if (fm) {
        var t = fm[1].match(/^title:\s*(.+)$/m);
        if (t) title = t[1].trim().replace(/^["']|["']$/g, '');
        body = raw.slice(fm[0].length);
      }
      /* 正文第一行是一级标题就把它提到标题，不然卡片上会重复一次 */
      var h1 = body.match(/^#\s+(.+)\r?\n/);
      if (h1) {
        if (!fm) title = h1[1].trim();
        body = body.replace(/^#\s+.+\r?\n/, '');
      }

      var now = Date.now();
      S.notes.push({
        id: uid(), text: title, src: null, body: body.trim(),
        created: now, up: now, del: 0
      });
      ok++;
      readOne(i + 1);
    };
    fr.onerror = function(){ skip++; readOne(i + 1); };
    fr.readAsText(f);
  };
  readOne(0);
}

/* 绑定放在 render.js 里统一调，和别的视图一样 */
function bindNotes(){
  var $ = function(id){ return document.getElementById(id); };

  if ($('ntimp')) $('ntimp').addEventListener('click', function(){ $('ntfile').click(); });
  if ($('ntfile')) $('ntfile').addEventListener('change', function(e){
    importMdFiles(e.target.files);
    e.target.value = '';
  });

  if ($('ntnew')) $('ntnew').addEventListener('click', function(){
    S.noteEdit = 'new';
    save(); render({top:true});
  });
  if ($('ntcancel')) $('ntcancel').addEventListener('click', function(){
    S.noteEdit = '';
    render({});
  });
  if ($('ntsave')) $('ntsave').addEventListener('click', function(){
    var title = ($('nttitle').value || '').trim();
    var srcRaw = ($('ntsrc').value || '').trim();
    var body = $('ntbody').value || '';

    var src = null;
    if (srcRaw) {
      src = detectMedia(srcRaw);
      if (!src) { toast('这个链接认不出来，可以只写正文'); return; }
    }
    if (!src && !body.trim() && !title) { toast('标题、来源、正文总得有一个'); return; }

    var now = Date.now();
    var cur = S.noteEdit === 'new' ? null
      : (S.notes || []).filter(function(x){ return x.id === S.noteEdit; })[0];

    if (cur) {
      cur.text = title;
      cur.src = src;
      cur.body = body;
      cur.up = now;
    } else {
      S.notes.push({ id: uid(), text: title, src: src, body: body, created: now, up: now, del: 0 });
    }
    S.noteEdit = '';
    save(); render({top:true});
    toast(cur ? '已更新' : '已存下');
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-note-edit]'), function(b){
    b.addEventListener('click', function(){
      S.noteEdit = b.dataset.noteEdit;
      save(); render({top:true});
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-note-del]'), function(b){
    b.addEventListener('click', function(){
      var n = (S.notes || []).filter(function(x){ return x.id === b.dataset.noteDel; })[0];
      if (!n) return;
      /* 留墓碑，另一台设备才收得到「这条被删了」 */
      n.del = 1;
      bumpUp(n);
      save(); render({});
      toast('删了一条笔记', function(){
        n.del = 0;
        bumpUp(n);
        save(); render({});
      });
    });
  });

  /* mermaid 图：默认只显示图，点一下露出源码 */
  Array.prototype.forEach.call(document.querySelectorAll('.mmm'), function(box){
    box.addEventListener('click', function(){
      box.classList.toggle('open');
    });
  });
}

VIEW_FN.notes = viewNotes;
