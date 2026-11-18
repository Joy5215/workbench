/**
 * 四象限交互测试：真浏览器点一遍。
 * 单测只能证明「合并算法没坏」，证明不了「点按钮真的改了数据」。
 * 这份专门补后者——每个断言都对着一处真实的失效方式。
 *
 * 跑法：由 tests/run.sh 起服务后调用，或
 *   PORT=8899 node tests/quad.test.cjs
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
  await page.setViewport({ width: 1280, height: 920 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });

  const wait = (ms) => new Promise((r) => setTimeout(r, ms || 160));
  const todos = () => page.evaluate(() =>
    JSON.parse(localStorage.getItem('myworkbench.v1')).todos
      .filter((t) => !t.del).map((t) => ({ t: t.text, u: t.urg, i: t.imp, d: t.done })));
  const cells = () => page.evaluate(() =>
    Array.from(document.querySelectorAll('.qc')).map((c) => c.dataset.q + ':' + c.querySelectorAll('.row').length).join(' '));
  const click = async (sel) => {
    await page.evaluate((s) => {
      const e = document.querySelector(s);
      if (!e) throw new Error('找不到 ' + s);
      e.click();
    }, sel);
    await wait();
  };
  /* 格内添加：点输入框、敲字、回车。这个动作曾经因为事件绑错目标而完全没反应。 */
  const qadd = async (q, txt) => {
    await page.click('.qc[data-q="' + q + '"] input');
    await page.keyboard.type(txt);
    await page.keyboard.press('Enter');
    await wait(220);
  };

  console.log('\n四象限交互');

  await click('#inp'); await page.keyboard.type('买菜'); await page.keyboard.press('Enter'); await wait();
  await click('[data-view="quad"]');
  ok('切到四象限后视图为 quad', await page.evaluate(() => !!document.querySelector('.quad')));
  ok('四格都在', (await page.evaluate(() => document.querySelectorAll('.qc').length)) === 4);
  ok('未标记的任务落在第四格', (await cells()) === 'do:0 plan:0 deleg:0 drop:1', await cells());

  await qadd('do', '交周报');
  let s = await todos();
  ok('格内添加真的写进了数据', s.some((x) => x.t === '交周报'), s);
  ok('格内添加带上了本格标记（急+重）',
    s.some((x) => x.t === '交周报' && x.u === 1 && x.i === 1), s);
  ok('它出现在第一格', (await cells()) === 'do:1 plan:0 deleg:0 drop:1', await cells());

  await qadd('plan', '读一本闲书');
  s = await todos();
  ok('第二格添加只带「重要」不带「紧急」',
    s.some((x) => x.t === '读一本闲书' && x.u === 0 && x.i === 1), s);

  await click('.qc[data-q="drop"] .row [data-imp]');
  s = await todos();
  ok('点「重」把任务标为重要', s.some((x) => x.t === '买菜' && x.i === 1), s);
  ok('它移到第二格', (await cells()) === 'do:1 plan:2 deleg:0 drop:0', await cells());

  /* 按文字选行，不按格子里的位置：同一格里有多条时第 n 个不一定是它 */
  const rowOf = (text) => page.evaluate((t) => {
    const rows = Array.from(document.querySelectorAll('.qc .row'));
    const r = rows.filter((x) => x.innerText.indexOf(t) >= 0)[0];
    return r ? r.closest('.qc').dataset.q : null;
  }, text);
  ok('买菜此刻在第二格', (await rowOf('买菜')) === 'plan');

  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.qc .row'));
    rows.filter((x) => x.innerText.indexOf('买菜') >= 0)[0].querySelector('[data-urg]').click();
  });
  await wait();
  s = await todos();
  ok('再点「急」变重要且紧急',
    s.some((x) => x.t === '买菜' && x.u === 1 && x.i === 1), s);
  ok('买菜移到了第一格', (await rowOf('买菜')) === 'do');

  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.qc .row'));
    rows.filter((x) => x.innerText.indexOf('交周报') >= 0)[0].querySelector('.cb').click();
  });
  await wait();
  ok('勾掉后从格子里消失', (await cells()) === 'do:1 plan:1 deleg:0 drop:0', await cells());
  ok('勾掉后 task 仍是完成态',
    (await todos()).some((x) => x.t === '交周报' && x.d === true));
  ok('已完成的不占四格的数',
    (await page.evaluate(() => document.querySelector('.page-s').innerText)).includes('已完成 1 件'));

  await click('[data-view="today"]');
  const titles = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.row .t')).map((e) => e.textContent));
  ok('今日页显示同一批任务', titles.length === 3, titles);
  ok('今日页每行都有「急」「重」两个切换',
    (await page.evaluate(() => document.querySelectorAll('.row [data-urg]').length)) === 3);

  await click('[data-view="quad"]');
  ok('回到四象限仍然正常', (await page.evaluate(() => !!document.querySelector('.quad'))));

  ok('全程无 JS 错误', errors.length === 0, errors);

  await browser.close();
  console.log('\n' + pass + ' 通过 / ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('测试自己挂了：', e); process.exit(1); });
