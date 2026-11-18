/* ---------- sync.js ----------
   文件夹同步：句柄存 IndexedDB、写入后读回点数、启动时悄悄看一眼远端。
   合并算法的本体在 core.js 的 mergeRecords()，这里只是把本地状态递进去。 */

/* 合并的入口：把 S 里的两个数组交给纯函数，返回统计。 */
function mergeInto(remote){
  return mergeRecords(S.todos, S.inbox, remote);
}

/* ==========================================================
   同步模块 · 文件通道
   ----------------------------------------------------------
   为什么不直接调百度网盘 API：2026-11-17 在浏览器里实测三条请求
   （简单 GET / 带 Authorization / PUT），全部 TypeError: Failed to fetch，
   控制台原文 blocked by CORS policy: No Access-Control-Allow-Origin。
   请求发出去了，服务端也答了，只是浏览器不许页面读结果。
   浏览器拦不住的是「往用户已授权的本地文件夹写文件」，所以走这条。
   ========================================================== */

var SYNC_FILE = 'workbench-sync.json';
var syncHandle = null;
var SY = { perm:'none', at:0, busy:false, note:'' };

/* --- 目录句柄存 IndexedDB。刷新后还在，但写入权限可能要再确认一次 --- */
function idbOp(mode, fn){
  return new Promise(function(res){
    var req;
    try { req = indexedDB.open('wb-sync', 1); } catch(e){ res(null); return; }
    req.onupgradeneeded = function(){ req.result.createObjectStore('kv'); };
    req.onerror = function(){ res(null); };
    req.onsuccess = function(){
      try {
        var tx = req.result.transaction('kv', mode);
        fn(tx.objectStore('kv'), res);
      } catch(e){ res(null); }
    };
  });
}
function idbGet(k){
  return idbOp('readonly', function(st, res){
    var q = st.get(k);
    q.onsuccess = function(){ res(q.result || null); };
    q.onerror = function(){ res(null); };
  });
}
function idbSet(k, v){
  return idbOp('readwrite', function(st, res){ st.put(v, k); res(v); });
}
function idbDel(k){
  return idbOp('readwrite', function(st, res){ st.delete(k); res(true); });
}

function hasFSA(){
  return !!(window.showDirectoryPicker && window.isSecureContext);
}

async function permOf(h, ask){
  if (!h) return 'none';
  try {
    var o = { mode:'readwrite' };
    var p = await h.queryPermission(o);
    if (p !== 'granted' && ask) p = await h.requestPermission(o);
    return p;
  } catch(e){ return 'none'; }
}

async function pickFolder(){
  if (!hasFSA()) { toast('这个浏览器不支持选文件夹'); return; }
  if (SY.busy) return;
  SY.busy = true; SY.note = '';
  render({});
  try {
    var h = await window.showDirectoryPicker({ mode:'readwrite', id:'wb-sync' });
    syncHandle = h;
    await idbSet('dir', h);
    SY.perm = await permOf(h, false);
    SY.busy = false;
    toast('已连接「' + (h.name || '这个文件夹') + '」');
    render({});
    await syncNow('full', { silent:true });
    return;
  } catch(e){
    if (e.name !== 'AbortError') { SY.note = '选择失败：' + (e.message || e.name); }
  }
  SY.busy = false;
  render({});
}

async function forgetFolder(){
  syncHandle = null;
  SY.perm = 'none'; SY.at = 0; SY.note = '';
  await idbDel('dir');
  render({});
  toast('已断开，文件夹里的文件没动');
}

/* 写：写完读回来点数。不能只凭 close() 没报错就说成功。 */
async function pushRemote(){
  if (!syncHandle) throw new Error('还没有选择文件夹');
  var perm = await permOf(syncHandle, true);
  if (perm !== 'granted') throw new Error('浏览器没给写入权限');
  var fh = await syncHandle.getFileHandle(SYNC_FILE, { create:true });
  var w = await fh.createWritable();
  var payload = {
    v: 2,
    devId: S.devId,
    savedAt: Date.now(),
    todos: S.todos,
    inbox: S.inbox
  };
  await w.write(JSON.stringify(payload, null, 1));
  await w.close();

  var f = await fh.getFile();
  var back = JSON.parse(await f.text());
  var got = (back.todos || []).length + (back.inbox || []).length;
  var want = S.todos.length + S.inbox.length;
  if (got !== want) throw new Error('写回条数不对：应 ' + want + ' 实 ' + got);
  return back;
}

async function fetchRemote(){
  if (!syncHandle) throw new Error('还没有选择文件夹');
  var perm = await permOf(syncHandle, true);
  if (perm !== 'granted') throw new Error('浏览器没给读取权限');
  var fh;
  try { fh = await syncHandle.getFileHandle(SYNC_FILE); }
  catch(e){ return null; }
  var txt = await (await fh.getFile()).text();
  if (!txt || !txt.trim()) return null;
  return JSON.parse(txt);
}

/* 墓碑留 30 天足够让所有设备都收到，之后就清掉，否则文件只增不减 */
function sweep(){
  var cut = Date.now() - 30 * 86400000;
  var n0 = S.todos.length + S.inbox.length;
  S.todos = S.todos.filter(function(x){ return !(x.del && (x.up || 0) < cut); });
  S.inbox = S.inbox.filter(function(x){ return !(x.del && (x.up || 0) < cut); });
  return n0 - (S.todos.length + S.inbox.length);
}

async function syncNow(mode, opt){
  opt = opt || {};
  if (SY.busy) return;
  if (!syncHandle) { toast('先选一个同步文件夹'); return; }
  SY.busy = true; SY.note = '';
  render({});
  try {
    var st = null, back = null;

    if (mode !== 'up') {
      var remote = await fetchRemote();
      if (remote) {
        st = mergeInto(remote);
      } else if (mode === 'down') {
        SY.note = '文件夹里还没有 ' + SYNC_FILE + '，这台设备可能是第一个';
      }
    }

    if (mode !== 'down') {
      back = await pushRemote();
      SY.at = back.savedAt;
    }

    sweep();
    save();
    SY.perm = 'granted';
    SY.busy = false;
    render({});

    if (opt.silent) {
      if (st && (st.add || st.upd || st.tomb)) {
        toast('合并了 ' + (st.add + st.upd) + ' 条来自另一台设备');
      }
      return;
    }
    if (st && (st.add || st.upd || st.tomb)) {
      toast('同步完成：新增 ' + st.add + ' · 更新 ' + st.upd
        + (st.tomb ? ' · 删除 ' + st.tomb : '') + ' · 未变 ' + st.same);
    } else if (st) {
      toast('两边一致，没有要合的东西');
    } else {
      toast('已写入同步文件夹');
    }
  } catch(e){
    SY.busy = false;
    SY.note = e.message || String(e);
    render({});
    toast('同步失败：' + SY.note);
  }
}

/* 启动时悄悄看一眼：远端比本地新就提示一句，不擅自改数据 */
async function autocheck(){
  try {
    var h = await idbGet('dir');
    if (!h) return;
    syncHandle = h;
    SY.perm = await permOf(h, false);
    if (SY.perm !== 'granted') { if (S.view === 'sync') render({}); return; }
    var remote = await fetchRemote();

    /* 文件夹里连 json 都没有 —— 这台设备是第一次连，把现在的数据种进去，
       否则网盘里永远只有一个 html，换台电脑打开就是空的。 */
    if (!remote) {
      var n0 = S.todos.length + S.inbox.length;
      if (n0) {
        await pushRemote();
        toast('已把这台设备的 ' + n0 + ' 条记录写进文件夹');
      } else {
        SY.note = '文件夹里还没有 ' + SYNC_FILE + '，这台设备也没有数据';
      }
      if (S.view === 'sync') render({});
      return;
    }

    /* 本地缓存丢了（换了文件名 / 换了浏览器 / 清了缓存）而文件夹里有数据：
       直接收下。这条是「换了台电脑打开是空的」的正解。 */
    var emptyLocal = !S.todos.length && !S.inbox.length;
    var remoteN = (remote.todos || []).length + (remote.inbox || []).length;
    if (emptyLocal && remoteN) {
      var got = mergeInto(remote);
      save(); render({});
      toast('已从文件夹恢复 ' + got.add + ' 条记录');
      return;
    }

    /* 两边都有：照常合并。以前这里只弹一句「另一台有更新」就不管了，
       等于把「打开就能看到别人的改动」这个最基本的要求丢了。 */
    if (!emptyLocal && remoteN) {
      var st = mergeInto(remote);
      if (st.add || st.upd || st.tomb) {
        save(); render({});
        toast('从文件夹同步了 ' + (st.add + st.upd) + ' 条'
          + (st.tomb ? '，删除 ' + st.tomb + ' 条' : ''));
        return;
      }
    }
    if (S.view === 'sync') render({});
  } catch(e){}
}

function viewSync(){
  var ok = hasFSA();
  var connected = !!syncHandle;
  var granted = SY.perm === 'granted';

  var h = '<div class="wrap"><h1 class="page-h">同步</h1>'
    + '<div class="page-s">手机上走 GitHub；电脑上还能选个同步文件夹</div>';

  /* GitHub 放最上面：它是唯一在手机上也能用的通道 */
  h += ghCard();

  /* 卡片一：连接状态 */
  var stCls = 'off', stTxt = '未设置';
  if (!ok) { stCls = 'off'; stTxt = '不支持'; }
  else if (connected) { stCls = granted ? 'on' : ''; stTxt = granted ? '已连接' : '待授权'; }

  h += '<div class="syc"><div class="hd"><span class="tt">同步文件夹</span>'
    + '<span class="st ' + stCls + '">' + stTxt + '</span></div>';

  if (!ok) {
    h += '<div class="hint">这个浏览器不支持直接读写文件夹，需要 <b>Chrome 或 Edge</b>。'
      + '<br>这一版没有第二条同步路可走：右上角的「导出」只能备份，导不回来。换浏览器打开就能用。</div></div>';
  } else if (!connected) {
    h += '<div class="hint">选一个文件夹。建议选<b>百度网盘同步空间</b>里的目录——客户端会自动把它同步到其他设备。</div>'
      + '<div class="btnrow"><button class="primary" id="pick">选择文件夹</button></div></div>';
  } else {
    h += '<div class="rw"><span class="k">文件夹</span><span class="v">' + esc(syncHandle.name || '（未命名文件夹）') + '</span></div>'
      + '<div class="rw"><span class="k">上次同步</span><span class="v">' + (SY.at ? fmt(SY.at) : '还没同步过') + '</span></div>'
      + '<div class="rw"><span class="k">本机标识</span><span class="v">' + esc(S.devId.slice(-6)) + '</span></div>';
    if (SY.note) {
      h += '<div class="rw"><span class="k">状态</span><span class="v"><span class="warn">' + esc(SY.note) + '</span></span></div>';
    }
    h += '<div class="btnrow">'
      + '<button class="primary" id="syn"' + (SY.busy ? ' disabled' : '') + '>' + (SY.busy ? '同步中…' : '立即同步') + '</button>'
      + '<button id="synup"' + (SY.busy ? ' disabled' : '') + '>只上传</button>'
      + '<button id="syndown"' + (SY.busy ? ' disabled' : '') + '>只下载</button>'
      + '<button id="forget"' + (SY.busy ? ' disabled' : '') + '>断开</button>'
      + '</div>';
    if (!granted) {
      /* 权限没给，打开时就读不到数据，会看起来像「数据没了」。
         所以这里必须有一键恢复，而不是让人去猜要点哪个。 */
      h += '<div class="hint"><b>浏览器把写入权限收回去了</b>，所以这次打开没能读数据。'
        + '点下面这个按钮恢复一次，之后每次打开都会自动读。</div>'
        + '<div class="btnrow"><button class="primary" id="reauth">恢复权限</button></div>';
    }
    h += '</div>';
  }

  /* 卡片二：接线步骤 */
  h += '<div class="syc"><div class="hd"><span class="tt">怎么接百度网盘</span>'
    + '<span class="st off">文件通道</span></div>'
    + '<div class="rw stp"><span class="k">1</span><span class="v">电脑上装百度网盘客户端，打开「同步空间」</span></div>'
    + '<div class="rw stp"><span class="k">2</span><span class="v">找到同步空间对应的本地文件夹</span></div>'
    + '<div class="rw stp"><span class="k">3</span><span class="v">回这里点「选择文件夹」，选它</span></div>'
    + '<div class="rw stp"><span class="k">4</span><span class="v">另一台设备做同样的事，选同一个同步目录</span></div>'
    + '<div class="hint">写进去的文件叫 <b>' + SYNC_FILE + '</b>，几十 KB。'
    + '百度网盘免费版每月给 1GB 同步流量，这点量用不完。'
    + '<br>手机浏览器不给网页选文件夹的能力，所以这一步只能在一台电脑上做——是浏览器的限制，不是功能没做。</div></div>';

  /* 卡片三：为什么不直接调接口（把实测结果摊开） */
  h += '<div class="syc"><div class="hd"><span class="tt">为什么不直接调百度网盘接口</span>'
    + '<span class="st off">实测</span></div>'
    + '<div class="hint">2026-11-17 在浏览器里真发了三条请求（简单 GET、带 Authorization、PUT），'
    + '全部返回 <b>TypeError: Failed to fetch</b>，控制台原文是 '
    + '<b>blocked by CORS policy: No “Access-Control-Allow-Origin” header</b>。'
    + '请求确实发出去了，服务端也答了，只是浏览器不许页面读结果。<br><br>'
    + '浏览器管不了的是「往你亲手授权的本地文件夹写文件」。所以这一版走文件，不走接口。</div></div>';

  h += '<div class="foot-note">冲突按每条记录的最后修改时间判，大头留给新的那份。'
    + '两台设备时钟差得多时可能判错，所以启动时只提示、不自动覆盖——要合就点「立即同步」，一次算完。</div>';

  return h + '</div>';
}


/* ---------- 同步页的按钮绑定 ----------
   这几个按钮不走事件委托（同步页要传参数、要 await），所以单独绑。
   同步页没渲染时 getElementById 全是 null，必须逐个 guard。 */
function bindSyncView(){
  bindGh();
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
}
