/**
 * media.js 单测 —— 媒体识别是个纯函数，能离线跑。
 *
 * 这条判错的代价不对称：
 *   把「一段话里夹着链接」当成媒体 → 用户写的正文被吞了，找不回来
 *   把「只有链接的一行」漏判成普通任务 → 待办里多一条看不懂的网址
 * 所以每条用例都盯着一个具体的边界，不是凑数。
 *
 * 跑法：node tests/media.test.cjs
 */
const assert = require('node:assert');
const path = require('node:path');

/* media.js 里有 document / btoa 之类的浏览器依赖，但它顶层只定义规则数组和纯函数。
   为了在 node 里跑，先补一个最小的全局，再 require。 */
global.document = { createElement: () => ({ style: {}, setAttribute() {} }) };
global.window = global;

const media = require(path.join(__dirname, '..', 'src', 'media.js'));

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✅', name); }
  catch (e) { fail++; console.log('  ❌', name, '\n      ', e.message); }
}

console.log('detectMedia');

t('B 站链接而且给出可嵌的播放器地址', () => {
  const m = media.detectMedia('https://www.bilibili.com/video/BV1GJ411x7h7');
  assert.equal(m.k, 'bili');
  assert.ok(m.frame.indexOf('player.bilibili.com') >= 0);
  assert.ok(m.frame.indexOf('BV1GJ411x7h7') >= 0);
  /* 带一堆查询参数的分享链接也要认出来 */
  const m2 = media.detectMedia('https://www.bilibili.com/video/BV1xx411c7mD?spm_id_from=333.999&vd_source=abc');
  assert.equal(m2.k, 'bili');
});

t('youtu.be 短链与完整地址等价', () => {
  const short = media.detectMedia('https://youtu.be/dQw4w9WgXcQ');
  const full = media.detectMedia('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(short.k, 'yt');
  assert.equal(short.frame, full.frame);
});

t('飞书和 WPS 是外站卡片，不给 iframe', () => {
  const f = media.detectMedia('https://abc.feishu.cn/docx/xyz');
  const w = media.detectMedia('https://www.kdocs.cn/l/abcdef');
  assert.equal(f.k, 'feishu');
  assert.equal(w.k, 'wps');
  /* 这两家 x-frame-options 是 DENY，给了 frame 地址也只会是白屏 */
  assert.equal(f.frame, null);
  assert.equal(w.frame, null);
});

t('图片与视频直链', () => {
  assert.equal(media.detectMedia('https://a.com/x.png').k, 'img');
  assert.equal(media.detectMedia('https://a.com/x.JPG').k, 'img');
  assert.ok(media.detectMedia('https://a.com/x.mp4').video);
});

t('不是链接就返回 null，不瞎猜', () => {
  assert.equal(media.detectMedia('买牛奶'), null);
  assert.equal(media.detectMedia(''), null);
  assert.equal(media.detectMedia('ftp://a.com/x'), null);
});

console.log('\nmediaOfText');

t('整条就是一个链接才当媒体', () => {
  const m = media.mediaOfText('https://www.bilibili.com/video/BV1GJ411x7h7');
  assert.ok(m && m.k === 'bili');
});

t('文字里夹着链接时不当媒体（否则正文会被吞）', () => {
  assert.equal(media.mediaOfText('看看这个 https://www.bilibili.com/video/BV1GJ411x7h7 怎么样'), null);
});

t('认不出的链接也不当媒体', () => {
  assert.equal(media.mediaOfText('https://example.com/some/page'), null);
});

console.log('\n' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
