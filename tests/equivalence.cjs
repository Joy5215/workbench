/**
 * 行为等价验证：原件 vs 拆分后构建产物。
 * 同一组操作，比对 localStorage 的脱敏快照 + 控制台错误数 + 渲染文本。
 */
const puppeteer = require('/tmp/node_modules/puppeteer-core');

// 服务根是「工作台」的父目录（由 tests/run.sh 起服务）
const ROOT = 'http://127.0.0.1:' + (process.env.PORT || '8899');
const CASES = [
  { label: '基线', url: ROOT + '/工作台/tests/baseline.html' },
  { label: '构建', url: ROOT + '/工作台/dist/我的工作台.html' },
];

/* 只比「基线那份也有的字段」。
   理由：新版本加了字段（如四象限的 urg/imp），它的默认值等于「没有这个功能之前的行为」，
   不该算作回归；但老字段的取值一个都不许变。漏掉的真 bug 会体现为老字段值不同，仍会报错。 */
const V1_FIELDS = ['text', 'done', 'doneAt', 'star', 'del'];

function mask(state) {
  // 去掉时间相关与随机 id，只留结构与业务字段
  const clean = (arr) => (arr || []).map((x) => {
    const o = {};
    V1_FIELDS.forEach((k) => { if (x[k] !== undefined) o[k] = x[k]; });
    return o;
  });
  return {
    todos: clean(state.todos),
    inbox: clean(state.inbox),
    hasSync: 'sync' in state || 'syncHint' in state,
  };
}

async function run(c) {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(c.url, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });

  /* 新版默认落在四象限（没有 #inp，只有格内输入框），
     所以先切到今日页——这份测试比的是两个版本的「今日」，不是首页长什么样。 */
  await page.evaluate(() => {
    const n = document.querySelector('[data-view="today"]');
    if (n) n.click();
  });
  await new Promise((r) => setTimeout(r, 200));

  const add = async (t) => {
    await page.waitForSelector('#inp', { timeout: 5000 });
    await page.click('#inp');
    await page.type('#inp', t);
    await page.keyboard.press('Enter');
    await new Promise((r) => setTimeout(r, 120));
  };

  await add('买牛奶');
  await add('写周报');
  await add('这条要删掉');
  await add('! 标重点的那条');
  await add('第四件用来验证排序');

  // 删除第一条（走事件委托，模拟真实点击）
  await page.evaluate(() => {
    const b = document.querySelector('[data-del]');
    if (!b) throw new Error('找不到 data-del');
    b.click();
  });
  await new Promise((r) => setTimeout(r, 150));

  // 切到「收件箱」再切回来，验证渲染路径
  await page.evaluate(() => {
    const n = document.querySelector('[data-view="inbox"]') || document.querySelector('[data-view]');
    if (n) n.click();
  });
  await new Promise((r) => setTimeout(r, 150));
  await page.evaluate(() => {
    const n = document.querySelector('[data-view="today"]');
    if (n) n.click();
  });
  await new Promise((r) => setTimeout(r, 150));

  const raw = await page.evaluate(() => localStorage.getItem('myworkbench.v1'));
  /* 文本比「标题 + 每条任务文案 + 副标题」，不比按钮文字：
     新版本会在行内多出「急 / 重」两个切换，那是新增功能，不是回归。
     任务文案与标题一个字都不许变。 */
  const text = await page.evaluate(() => {
    const body = document.querySelector('.body') || document.body;
    const pick = (sel) => Array.from(body.querySelectorAll(sel)).map((e) => e.innerText.trim());
    return {
      h: pick('.page-h'), sub: pick('.page-s'),
      t: pick('.tx .t'), empty: pick('.empty .t1'),
    };
  });
  const domRows = await page.evaluate(() => document.querySelectorAll('.row').length);

  await browser.close();
  return { label: c.label, state: mask(JSON.parse(raw || '{}')), text, domRows, errors };
}

(async () => {
  const out = [];
  for (const c of CASES) out.push(await run(c));

  let ok = true;
  const a = out[0], b = out[1];
  const sa = JSON.stringify(a.state, null, 1);
  const sb = JSON.stringify(b.state, null, 1);
  console.log('=== 记录结构 ===');
  console.log(JSON.stringify(a.state, null, 1));

  const eq = (name, x, y) => {
    const pass = JSON.stringify(x) === JSON.stringify(y);
    if (!pass) ok = false;
    console.log(`${pass ? '✅' : '❌'} ${name}`);
    if (!pass) console.log('   原件:', JSON.stringify(x), '\n   构建:', JSON.stringify(y));
  };

  console.log('\n=== 比对 ===');
  eq('localStorage 脱敏后完全一致', a.state, b.state);
  eq('渲染文本一致', a.text, b.text);
  eq('DOM 行数一致', a.domRows, b.domRows);
  eq('无 JS 错误', a.errors, b.errors);
  eq('无 JS 错误（构建版单独）', b.errors, []);

  console.log('\n  todos:', a.state.todos.length, '条（含 1 条墓碑:', a.state.todos.filter((x) => x.del).length, '）');
  console.log('  渲染行数:', a.domRows);
  if (a.errors.length) console.log('  错误:', a.errors);
  process.exit(ok ? 0 : 1);
})();
