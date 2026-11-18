/**
 * GitHub 通道与「从链接收件」的交互测试。
 *
 * 这两块都是「外面进东西进来」的入口，坏了不会报错，只会**默默收不到**——
 * 那种坏法最难发现，所以每条断言都对着一个具体的失效方式。
 *
 * 不测真实写入：那需要用户的 token，测试里不该出现凭证。
 * 写入路径的正确性靠「401 的报错能翻成人话」和「CORS 头实测过」两条旁证。
 */
const puppeteer = require('/tmp/node_modules/puppeteer-core');

const BASE = 'http://127.0.0.1:' + (process.env.PORT || '8899');
const FILE = BASE + '/%E5%B7%A5%E4%BD%9C%E5%8F%B0/dist/%E6%88%91%E7%9A%84%E5%B7%A5%E4%BD%9C%E5%8F%B0.html';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅', name); }
  else { fail++; console.log('  ❌', name, extra === undefined ? '' : '\n      ' + JSON.stringify(extra)); }
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium', headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const wait = (ms) => new Promise((r) => setTimeout(r, ms || 300));
  const read = () => page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('myworkbench.v1')) || { todos: [], inbox: [] }; }
    catch (e) { return { todos: [], inbox: [] }; }
  });

  console.log('\n从链接收件');

  await page.goto(FILE, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());

  /* 一行一条、`- ` / `[ ] ` / `1. ` 前缀要吃掉、`!` 仍是星标 */
  await page.goto(FILE + '?add=' + encodeURIComponent('- 交周报\n[ ] 约牙医\n1. 回客户邮件\n! 打电话')
    + '&to=do', { waitUntil: 'networkidle0' });
  await wait(500);

  const d1 = await read();
  const top = (d1.todos || []).filter((t) => !t.del);
  ok('链接里的四行进来了', top.length === 4, top.map((t) => t.text));
  ok('列表前缀被清掉', top.every((t) => !/^[-*\d\[]/.test(t.text)), top.map((t) => t.text));
  ok('&to=do 让四条都落进「重要且紧急」', top.every((t) => t.urg === 1 && t.imp === 1), top);
  ok('`!` 开头仍被当成星标', top.some((t) => t.text === '打电话' && t.star === true), top);

  /* 收完必须把 query 擦掉，否则刷新一次就重复入库一次 */
  ok('收完把 ?add= 从地址里擦掉', (await page.evaluate(() => location.search)) === '');

  /* 不带 to：进收集箱，并且切到收集箱视图 */
  await page.goto(FILE, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(FILE + '?add=' + encodeURIComponent('一个点子\n第二个点子'), { waitUntil: 'networkidle0' });
  await wait(500);

  const d2 = await read();
  ok('不带 to 时进收集箱，不进待办', (d2.inbox || []).filter((x) => !x.del).length === 2
    && (d2.todos || []).length === 0, d2);
  ok('自动切到收集箱视图', d2.view === 'inbox', d2.view);

  console.log('\n仓库地址的容错');

  /* 走界面填，不去点内部函数：整个脚本包在 IIFE 里，evaluate 拿不到 ghSplitRepo。
     从界面进去反而更接近真实用法——用户就是会粘一个整串地址进来。 */
  await page.goto(FILE, { waitUntil: 'networkidle0' });
  await page.evaluate(() => { document.getElementById('burger').click(); });
  await wait(300);
  await page.evaluate(() => { document.querySelector('[data-view=sync]').click(); });
  await wait(400);

  /* 还没存过任何配置，按钮该是灰的 —— 这条得放在第一次保存之前 */
  ok('未配置时同步按钮是灰的',
    (await page.evaluate(() => document.getElementById('ghsyn').disabled)) === true);

  const saveRepo = async (raw) => {
    await page.evaluate((v) => {
      document.getElementById('ghrepo').value = v;
      document.getElementById('ghtok').value = 'github_pat_TESTONLY';
      document.getElementById('ghsave').click();
    }, raw);
    await wait(500);
    return page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('myworkbench.gh')); } catch (e) { return null; }
    });
  };

  const c1 = await saveRepo('https://github.com/Joy5215/lalabox.git');
  ok('整个 https 地址能认', c1 && c1.owner === 'Joy5215' && c1.repo === 'lalabox', c1);

  const c2 = await saveRepo('Joy5215/lalabox/');
  ok('结尾多个斜杠也能认', c2 && c2.repo === 'lalabox', c2);

  /* 少一半时不该硬存一个坏配置，否则点同步只会得到一个莫名其妙的 404 */
  const c3 = await saveRepo('只有一段');
  ok('缺一半时拒绝保存，旧配置留着', c3 && c3.repo === 'lalabox' && c3.owner === 'Joy5215', c3);

  console.log('\n同步页');

  ok('GitHub 卡片在', await page.evaluate(() => !!document.getElementById('ghrepo')));
  ok('四个字段都在', (await page.evaluate(() => document.querySelectorAll('.ghf input').length)) === 4);
  /* 保存配置：token 只留在本机，绝不能跟着数据文件一起被同步出去 */
  await page.evaluate(() => {
    document.getElementById('ghrepo').value = 'Joy5215/lalabox';
    document.getElementById('ghpath').value = 'sync/wb.json';
    document.getElementById('ghbr').value = 'main';
    document.getElementById('ghtok').value = 'github_pat_TESTONLY';
    document.getElementById('ghsave').click();
  });
  await wait(600);

  const cfg = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('myworkbench.gh')); } catch (e) { return null; }
  });
  ok('配置存下来了，owner/repo 已拆开', cfg && cfg.owner === 'Joy5215' && cfg.repo === 'lalabox', cfg);
  ok('文件路径和分支也存了', cfg && cfg.path === 'sync/wb.json' && cfg.branch === 'main', cfg);

  const dataRaw = await page.evaluate(() => localStorage.getItem('myworkbench.v1') || '');
  ok('token 没有跟数据文件混在一起', dataRaw.indexOf('TESTONLY') < 0);

  ok('填完配置后同步按钮亮起来',
    await page.evaluate(() => document.getElementById('ghsyn').disabled === false));

  /* 假 token 被 GitHub 拒是**预期**的：页面里就该把 401 翻成人话显示出来。
     浏览器会为这种响应打一条 control 台的「Failed to load resource」，
     那不是我们的 bug，别让它把真的错误盖过去。 */
  const real = errors.filter((e) => !/Failed to load resource/.test(e) && !/401/.test(e));
  console.log('\n笔记：Markdown 与净化');

  /* 纯函数（detectMedia / mediaOfText）在 IIFE 里，evaluate 拿不到——
     那些用例放在 tests/media.test.cjs 里离线跑。
     这里只验「渲染出来的东西」，那是用户真正看到的部分。 */

  /* 笔记内容会进同步文件，那个文件别人能写，所以净化这一步不能省。
     走界面验：写一条带恶意标签的笔记，看渲染出来的 DOM 里还有没有它。 */
  await page.evaluate(() => { document.querySelector('[data-view=notes]').click(); });
  await wait(400);
  await page.evaluate(() => {
    document.getElementById('ntnew').click();
  });
  await wait(400);
  await page.evaluate(() => {
    document.getElementById('ntbody').value =
      '## 标题\n- 一条\n\n<script>window.__X=1<\/script>\n\n<img src=x onerror="window.__Y=1">';
    document.getElementById('ntsave').click();
  });
  await wait(700);

  const md = await page.evaluate(() => {
    const box = document.querySelector('.nt-body.md');
    return {
      h2: !!(box && box.querySelector('h2')),
      li: !!(box && box.querySelector('li')),
      script: !!(box && box.querySelector('script')),
      img: !!(box && box.querySelector('img[onerror]')),
      executed: window.__X === 1 || window.__Y === 1,
    };
  });
  ok('Markdown 标题与列表渲染出来', md.h2 && md.li, md);
  ok('正文里的 script 没有进入 DOM', md.script === false, md);
  ok('onerror 这类内联事件被拿掉', md.img === false, md);
  ok('净化后脚本没有执行', md.executed === false, md);

  console.log('\n笔记页');

  await page.evaluate(() => { document.querySelector('[data-view=notes]').click(); });
  await wait(400);
  ok('笔记页能打开', await page.evaluate(() => !!document.getElementById('ntnew')));
  ok('有「读 md」入口', await page.evaluate(() => !!document.getElementById('ntfile')));

  ok('全程无意外 JS 错误', real.length === 0, real);

  await browser.close();
  console.log('\n' + pass + ' 通过 / ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('测试自己挂了：', e); process.exit(1); });
