/* ---------- sync-gh.js ----------
   GitHub 通道：把同步文件放进仓库，前端直接调 Contents API 读写。

   为什么这条能成、而百度网盘 / 坚果云 / 飞书都不行 —— 2026-11-18 实测：
     api.github.com 的 OPTIONS 预检返回
       access-control-allow-origin: *
       access-control-allow-methods: GET, POST, PATCH, PUT, DELETE
       access-control-allow-headers: Authorization, Content-Type, If-Match, ...
     连一个 401 的响应也照带 allow-origin。那三家的响应里没有这个头。

   代价说清楚：
   1. token 存在本机 localStorage。XSS 能拿走它。所以必须用 fine-grained token，
      只授权这一个仓库的 Contents 读写，泄露了也只影响这一个文件。
   2. 仓库是 public 的话，这个 json 人人都能看。要私密就换私有仓库（Pages 照样能用）。
   3. 一次 PUT 上限 1MB，装几万条待办够用；超过会在写入前先报错。 */

var GH_KEY = 'myworkbench.gh';
var GH = { busy:false, note:'', at:0 };

function ghCfg(){
  try { return JSON.parse(localStorage.getItem(GH_KEY)) || {}; }
  catch(e){ return {}; }
}
function ghSet(cfg){
  try { localStorage.setItem(GH_KEY, JSON.stringify(cfg)); } catch(e){}
}
function ghReady(){
  var c = ghCfg();
  return !!(c.repo && c.token);
}
/* 允许用户只填 "owner/repo" 或者整个 https 地址，都认 */
function ghSplitRepo(v){
  var s = String(v || '').trim()
    .replace(/^https?:\/\/github\.com\//, '')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '');
  var m = s.split('/');
  if (m.length < 2 || !m[0] || !m[1]) return null;
  return { owner: m[0], repo: m[1] };
}

/* ---------- base64：中文字符串不能直接 btoa ---------- */
function b64enc(str){
  var bytes = new TextEncoder().encode(str);
  var bin = '';
  var CH = 0x8000;
  for (var i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  }
  return btoa(bin);
}
function b64dec(s){
  var bin = atob(String(s || '').replace(/\s/g, ''));
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/* ---------- 一次 API 调用 ----------
   统一把 GitHub 的错误体翻成一句人话，否则页面上只会看到 "409"。 */
function ghApi(path, opt){
  opt = opt || {};
  var c = ghCfg();
  var headers = {
    'Authorization': 'Bearer ' + c.token,
    'Accept': 'application/vnd.github+json'
  };
  if (opt.body) headers['Content-Type'] = 'application/json';

  return fetch('https://api.github.com' + path, {
    method: opt.method || 'GET',
    headers: headers,
    body: opt.body ? JSON.stringify(opt.body) : undefined,
    cache: 'no-store'
  }).then(function(res){
    if (res.status === 404) return { missing: true };
    if (res.ok) return res.json().then(function(j){ return { json: j }; });

    return res.text().then(function(t){
      var msg = '';
      try { msg = JSON.parse(t).message || ''; } catch(e){ msg = String(t).slice(0, 100); }
      var err = new Error('GitHub ' + res.status + (msg ? '：' + msg : ''));
      err.status = res.status;
      throw err;
    });
  });
}

function ghFilePath(){
  var c = ghCfg();
  return (c.path || 'workbench-sync.json').replace(/^\/+/, '');
}
function ghBranch(){
  return ghCfg().branch || 'main';
}

/* 读远端。没有文件返回 null（第一次用，不是错）。 */
async function ghPull(){
  var c = ghCfg();
  var r = await ghApi('/repos/' + c.owner + '/' + c.repo + '/contents/'
    + ghFilePath().split('/').map(encodeURIComponent).join('/')
    + '?ref=' + encodeURIComponent(ghBranch()));

  if (r.missing) return null;
  var txt = b64dec(r.json.content || '');
  if (!txt.trim()) return null;
  var data = JSON.parse(txt);
  data.__sha = r.json.sha;
  return data;
}

/* 写远端。sha 是乐观锁：不是最新版 GitHub 直接拒，避免悄悄覆盖另一台设备的改动。 */
async function ghPut(sha){
  var c = ghCfg();
  var payload = {
    v: 2,
    devId: S.devId,
    savedAt: Date.now(),
    todos: S.todos,
    inbox: S.inbox,
    notes: S.notes || []
  };
  var text = JSON.stringify(payload, null, 1);
  /* Contents API 的硬上限。超了不会有半个文件，是整次拒绝，所以提前说清楚。 */
  if (text.length > 700 * 1024) {
    throw new Error('数据已经 ' + Math.round(text.length / 1024) + 'KB，超过这条通道的安全线（700KB）');
  }

  var body = {
    message: 'sync ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' · ' + S.devId.slice(-4),
    content: b64enc(text),
    branch: ghBranch()
  };
  if (sha) body.sha = sha;

  var r = await ghApi('/repos/' + c.owner + '/' + c.repo + '/contents/'
    + ghFilePath().split('/').map(encodeURIComponent).join('/'),
    { method: 'PUT', body: body });

  return r.json && r.json.content ? r.json.content.sha : null;
}

/* 推的时候撞了车（另一台设备刚写完）：重拉、合并、再推一次。
   不重试的话，那一次冲突就等于「我这台的改动丢了」。 */
async function ghPutWithRetry(sha){
  try {
    return await ghPut(sha);
  } catch(e){
    if (e.status !== 409 && e.status !== 422) throw e;
    var cur = await ghPull();
    if (cur) mergeInto(cur);
    save();
    return await ghPut(cur ? cur.__sha : null);
  }
}

/* mode: 'both' | 'up' | 'down'，跟文件通道同一套语义 */
async function ghSync(mode, opt){
  opt = opt || {};
  if (GH.busy) return;
  if (!ghReady()) { toast('先把仓库和 token 填上'); return; }

  GH.busy = true; GH.note = '';
  render({});
  try {
    var st = null;

    if (mode !== 'up') {
      var remote = await ghPull();
      if (remote) {
        st = mergeInto(remote);
      } else if (mode === 'down') {
        GH.note = '仓库里还没有这个文件，这台设备可能是第一个';
      }
    }

    if (mode !== 'down') {
      /* 推之前先拿一次最新的 sha —— 拉取到现在可能已经过了几秒 */
      var cur = await ghPull();
      if (cur && mode === 'both') {
        /* ghPull 已经合并过，这里只补一条：pull 之后别人又写的，也要并进来 */
        st = st || { add:0, upd:0, tomb:0, same:0 };
      }
      await ghPutWithRetry(cur ? cur.__sha : null);
      GH.at = Date.now();
    }

    sweep();
    save();
    GH.busy = false;
    render({});

    if (opt.silent) {
      if (st && (st.add || st.upd || st.tomb)) {
        toast('从 GitHub 合并了 ' + (st.add + st.upd) + ' 条');
      }
      return;
    }
    if (st && (st.add || st.upd || st.tomb)) {
      toast('同步完成：新增 ' + st.add + ' · 更新 ' + st.upd
        + (st.tomb ? ' · 删除 ' + st.tomb : '') + ' · 未变 ' + st.same);
    } else if (st) {
      toast('两边一致，没有要合的东西');
    } else {
      toast('已写入 GitHub');
    }
  } catch(e){
    GH.busy = false;
    GH.note = e.message || String(e);
    render({});
    toast('GitHub 同步失败：' + GH.note);
  }
}

/* 启动时悄悄试一次。没网 / token 失效就安静退出，不弹东西打扰。 */
async function ghAutocheck(){
  if (!ghReady()) return;
  try {
    var remote = await ghPull();
    if (!remote) return;
    var emptyLocal = !S.todos.length && !S.inbox.length;
    var st = mergeInto(remote);
    if (emptyLocal || st.add || st.upd || st.tomb) {
      save(); render({});
      toast('从 GitHub 恢复了 ' + (st.add + st.upd) + ' 条' + (st.tomb ? '，删除 ' + st.tomb : ''));
    }
  } catch(e){ /* 静默 */ }
}

/* ---------- 同步页上的那张卡片 ----------
   字段直接摊在页面上，不做「点编辑才显示」。这是个自用工具，
   多一层折叠就多一次「我上次怎么配的来着」。 */
function ghCard(){
  var c = ghCfg();
  var has = ghReady();

  var h = '<div class="syc"><div class="hd"><span class="tt">GitHub 通道</span>'
    + '<span class="st ' + (has ? 'on' : 'off') + '">' + (has ? '已配置' : '未配置') + '</span></div>'
    + '<div class="page-s" style="margin:0 0 13px">手机、电脑都能用</div>';

  h += '<div class="ghf">'
    + '<label><span>仓库</span><input id="ghrepo" placeholder="用户名/仓库名" spellcheck="false" autocomplete="off" value="'
    + esc(c.owner && c.repo ? c.owner + '/' + c.repo : '') + '"></label>'
    + '<label><span>文件</span><input id="ghpath" placeholder="workbench-sync.json" spellcheck="false" autocomplete="off" value="'
    + esc(c.path || '') + '"></label>'
    + '<label><span>分支</span><input id="ghbr" placeholder="main" spellcheck="false" autocomplete="off" value="'
    + esc(c.branch || '') + '"></label>'
    + '<label><span>Token</span><input id="ghtok" type="password" placeholder="github_pat_…" spellcheck="false" autocomplete="off" value="'
    + esc(c.token || '') + '"></label>'
    + '</div>';

  h += '<div class="btnrow">'
    + '<button class="primary" id="ghsave">保存</button>'
    + '<button id="ghsyn"' + (GH.busy || !has ? ' disabled' : '') + '>' + (GH.busy ? '同步中…' : '立即同步') + '</button>'
    + '<button id="ghup"' + (GH.busy || !has ? ' disabled' : '') + '>只上传</button>'
    + '<button id="ghdown"' + (GH.busy || !has ? ' disabled' : '') + '>只下载</button>'
    + '</div>';

  if (GH.at) {
    h += '<div class="rw"><span class="k">上次同步</span><span class="v">' + fmt(GH.at) + '</span></div>';
  }
  if (GH.note) {
    h += '<div class="rw"><span class="k">状态</span><span class="v"><span class="warn">' + esc(GH.note) + '</span></span></div>';
  }

  h += '<div class="hint">Token：Settings → Developer settings → <b>Fine-grained tokens</b>，'
    + '只勾这一个仓库，权限给 <b>Contents: Read and write</b>。'
    + '<br>public 仓库里这个 json 谁都能看，要私密就换私有仓库。</div></div>';

  return h;
}

function bindGh(){
  var save = document.getElementById('ghsave');
  if (!save) return;

  var readForm = function(){
    var repoRaw = (document.getElementById('ghrepo').value || '').trim();
    var sp = ghSplitRepo(repoRaw);
    return {
      owner: sp ? sp.owner : '',
      repo: sp ? sp.repo : '',
      path: (document.getElementById('ghpath').value || '').trim() || 'workbench-sync.json',
      branch: (document.getElementById('ghbr').value || '').trim() || 'main',
      token: (document.getElementById('ghtok').value || '').trim()
    };
  };

  save.addEventListener('click', function(){
    var cfg = readForm();
    if (!cfg.owner || !cfg.repo) { toast('仓库要写成 用户名/仓库名'); return; }
    if (!cfg.token) { toast('还没填 token'); return; }
    ghSet(cfg);
    toast('已保存，正在试连接…');
    testGh();
  });

  var bS = document.getElementById('ghsyn');
  if (bS) bS.addEventListener('click', function(){ ghSync('both'); });
  var bU = document.getElementById('ghup');
  if (bU) bU.addEventListener('click', function(){ ghSync('up'); });
  var bD = document.getElementById('ghdown');
  if (bD) bD.addEventListener('click', function(){ ghSync('down'); });
}

/* 测试连接：拉一次，能拉到 / 拉到空 都算通。
   失败时把 GitHub 的原话贴出来——403 是权限不对，401 是 token 错，404 是仓库名写错了，
   这三种在页面上长得完全不一样，含糊过去等于让人瞎试。 */
async function testGh(){
  if (!ghReady()) { toast('先把仓库和 token 填上'); return; }
  try {
    var remote = await ghPull();
    if (!remote) {
      GH.note = '';
      toast('连得上，仓库里还没有这个文件（第一次保存时会创建）');
    } else {
      var n = (remote.todos || []).length + (remote.inbox || []).length;
      GH.note = '';
      toast('连得上：远端 ' + n + ' 条记录');
    }
  } catch(e){
    GH.note = e.message || String(e);
    toast('连不上：' + GH.note);
  }
  render({});
}
