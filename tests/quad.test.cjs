/**
 * 四象限与收集箱的交互测试：真浏览器点一遍。
 * 单测只能证明「合并算法没坏」，证明不了「点按钮真的改了数据」。
 * 每个断言都对着一处真实的失效方式，不是为凑数。
 *
 * 跑法：由 tests/run.sh 起服务后调用。
 */
const puppeteer = require('/tmp/node_modules/puppeteer-core');

const BASE = 'http://127.0.0.1:' + (process.env.PORT || '8899');
const URL = BASE + '/%E5%B7%A5%E4%BD%9C%E5%8F%B0/dist/%E6%88%91%E7%9A%84%E5%B7%A5%E4%BD%9C%E5%8F%B0.html';

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

  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });

  const wait = (ms) => new Promise((r) => setTimeout(r, ms || 180));
  /* 首屏没写过任何东西时 localStorage 还是空的，读出来是 null。
     读数据的辅助函数一律兜底成 {todos:[],inbox:[]}，否则「初始为空」这一步就先崩了。 */
  const read = () => page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('myworkbench.v1')) || { todos: [], inbox: [] }; }
    catch (e) { return { todos: [], inbox: [] }; }
  });
  const todos = () => read().then((d) => (d.todos || [])
    .filter((t) => !t.del).map((t) => ({ t: t.text, u: t.urg, i: t.imp, d: t.done })));
  const inboxCount = () => read().then((d) => (d.inbox || []).filter((x) => !x.del).length);
  const cells = () => page.evaluate(() => Array.from(document.querySelectorAll('.qc'))
    .map((c) => c.dataset.q + ':' + c.querySelectorAll('.qrow').length).join(' '));
  const click = async (sel) => {
    await page.evaluate((s) => {
      const e = document.querySelector(s);
      if (!e) throw new Error('找不到 ' + s);
      e.click();
    }, sel);
    await wait();
  };
  /* 滴答式录入：点 + → 选格子 → 打字 → 回车 */
  const addVia = async (quad, txt) => {
    await wait(250);
    await click('#fab');
    await click('[data-pick="' + quad + '"]');
    await wait(250);
    await page.click('[data-qin="' + quad + '"]');
    await page.keyboard.type(txt);
    await page.keyboard.press('Enter');
    await wait(240);
  };

  console.log('\n四象限布局');

  ok('默认落在四象限', await page.evaluate(() => !!document.querySelector('.quad')));
  ok('四格都在', (await page.evaluate(() => document.querySelectorAll('.qc').length)) === 4);
  ok('2×2 撑满屏，整页不滚动',
    await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1));
  ok('格子高度均分（四格一样高）', await page.evaluate(() => {
    const hs = Array.from(document.querySelectorAll('.qc')).map((c) => Math.round(c.getBoundingClientRect().height));
    return Math.max(...hs) - Math.min(...hs) <= 1;
  }));
  ok('格子标题前有小色点', (await page.evaluate(() => document.querySelectorAll('.qc .qh .qd').length)) === 4);

  console.log('\n录入');

  const before = (await todos()).length;
  ok('初始没有任务', before === 0, before);

  await addVia('do', '交周报');
  let s = await todos();
  ok('+ 选格后录入，数据进去了', s.some((x) => x.t === '交周报'), s);
  ok('带上了这一格的标记（急+重）', s.some((x) => x.t === '交周报' && x.u === 1 && x.i === 1), s);
  ok('落在第一格', (await cells()) === 'do:1 plan:0 deleg:0 drop:0', await cells());

  await addVia('plan', '读一本书');
  s = await todos();
  ok('第二格只带「重要」', s.some((x) => x.t === '读一本书' && x.u === 0 && x.i === 1), s);
  ok('任务行下面有时间小字',
    await page.evaluate(() => {
      const r = Array.from(document.querySelectorAll('.qrow')).filter((e) => e.innerText.indexOf('读一本书') >= 0)[0];
      return !!r && !!r.querySelector('.qt2') && r.querySelector('.qt2').innerText.trim().length > 0;
    }));

  /* 按文案定位要勾的那一行：DOM 顺序是 第一格→第二格，`[data-tog]` 取第一个会勾错人 */
  await page.evaluate(() => {
    const r = Array.from(document.querySelectorAll('.qrow')).filter((e) => e.innerText.indexOf('读一本书') >= 0)[0];
    r.querySelector('[data-tog]').click();
  });
  await wait();
  ok('勾掉后变成完成态', (await todos()).some((x) => x.t === '读一本书' && x.d === true));
  ok('勾掉的那条从格子里消失（另一条不受影响）',
    (await page.evaluate(() => document.querySelectorAll('.qc[data-q=plan] .qrow').length)) === 0
    && (await page.evaluate(() => document.querySelectorAll('.qc[data-q=do] .qrow').length)) === 1,
    await cells());

  console.log('\n收集箱');

  await click('[data-view="inbox"]');
  await page.click('#inp'); await page.keyboard.type('想到一件杂事'); await page.keyboard.press('Enter'); await wait(200);
  ok('收集箱有条目', (await inboxCount()) === 1);

  await click('[data-view="quad"]');
  ok('四象限顶部出现收集箱条',
    await page.evaluate(() => !!document.querySelector('.qbar')));
  ok('条上写着条数 1',
    (await page.evaluate(() => document.querySelector('.qbar .qbar-n').innerText.trim())) === '1');

  await click('.qbar');
  ok('点开后底部浮层出现', await page.evaluate(() => !!document.querySelector('#sheet .sh')));
  ok('浮层里有 4 个归位按钮 + 1 个删除',
    (await page.evaluate(() => document.querySelectorAll('#sheet [data-move]').length)) === 4
    && (await page.evaluate(() => document.querySelectorAll('#sheet .sh-del').length)) === 1);

  await click('#sheet [data-move][data-to="deleg"]');
  ok('归位后收集箱清空', (await inboxCount()) === 0);
  ok('任务进了「不重要但紧急」',
    (await todos()).some((x) => x.t === '想到一件杂事' && x.u === 1 && x.i === 0));
  ok('收集箱条随之消失', await page.evaluate(() => !document.querySelector('.qbar')));

  console.log('\n今日页仍然可用');

  await click('[data-view="today"]');
  ok('今日页有输入框', await page.evaluate(() => !!document.getElementById('inp')));
  ok('今日页每行带「急」「重」切换',
    (await page.evaluate(() => document.querySelectorAll('.row [data-urg]').length)) >= 1);

  ok('全程无 JS 错误', errors.length === 0, errors);

  await browser.close();
  console.log('\n' + pass + ' 通过 / ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('测试自己挂了：', e); process.exit(1); });
