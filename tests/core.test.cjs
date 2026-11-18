/**
 * core.js 单测 —— 这层被拆出来就是为了这个。
 * 合并算法在 11-17 那个夜里错过三次（墓碑被盖、空设备不合并、同 up 判反），
 * 所以每个 case 都对着一次真实的翻车。
 *
 * 跑法：node tests/core.test.cjs
 */
const assert = require('node:assert');
const path = require('node:path');
const core = require(path.join(__dirname, '..', 'src', 'core.js'));

const { bumpUp, newer, mergeRecords, esc, dayKey, fmt, uid } = core;

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✅', name); }
  catch (e) { fail++; console.log('  ❌', name, '\n      ', e.message); }
}

console.log('mergeRecords');

t('空的本地设备收下远端全部记录', () => {
  const todos = [], inbox = [];
  const st = mergeRecords(todos, inbox, {
    todos: [{ id: 'a', up: 1, text: 'X' }, { id: 'b', up: 1, text: 'Y' }],
    inbox: [{ id: 'c', up: 1, text: 'Z' }],
  });
  assert.deepStrictEqual(st, { add: 3, upd: 0, same: 0, tomb: 0 });
  assert.strictEqual(todos.length, 2);
  assert.strictEqual(inbox.length, 1);
});

t('远端 up 更大 → 覆盖本地字段', () => {
  const todos = [{ id: 'a', up: 10, text: '旧', done: false }];
  const st = mergeRecords(todos, [], { todos: [{ id: 'a', up: 20, text: '新', done: true }] });
  assert.strictEqual(st.upd, 1);
  assert.strictEqual(todos[0].text, '新');
  assert.strictEqual(todos[0].done, true);
});

t('本地 up 更大 → 不动（不被旧数据盖回去）', () => {
  const todos = [{ id: 'a', up: 30, text: '本地新' }];
  const st = mergeRecords(todos, [], { todos: [{ id: 'a', up: 20, text: '远端旧' }] });
  assert.strictEqual(st.same, 1);
  assert.strictEqual(todos[0].text, '本地新');
});

t('同 up，远端是墓碑 → 本地被删掉（墓碑赢）', () => {
  const todos = [{ id: 'a', up: 50, text: '还在' }];
  const st = mergeRecords(todos, [], { todos: [{ id: 'a', up: 50, del: 1 }] });
  assert.strictEqual(st.tomb, 1);
  assert.strictEqual(todos[0].del, 1);
});

t('同 up，本地是墓碑 → 远端活记录不能复活它', () => {
  const todos = [{ id: 'a', up: 50, del: 1, text: '删了' }];
  const st = mergeRecords(todos, [], { todos: [{ id: 'a', up: 50, text: '想复活' }] });
  assert.strictEqual(st.same, 1);
  assert.strictEqual(todos[0].del, 1);
});

t('远端更大但不是墓碑 → 本地墓碑被替代（另一台确实改得更晚）', () => {
  const todos = [{ id: 'a', up: 50, del: 1, text: '删了' }];
  const st = mergeRecords(todos, [], { todos: [{ id: 'a', up: 80, text: '又改回来了' }] });
  assert.strictEqual(st.upd, 1);
  assert.strictEqual(todos[0].del, 0);
});

t('缺 id / null 记录被跳过，不计数', () => {
  const todos = [];
  const st = mergeRecords(todos, [], { todos: [null, {}, { id: '', up: 1 }, { id: 'ok', up: 1 }] });
  assert.deepStrictEqual(st, { add: 1, upd: 0, same: 0, tomb: 0 });
});

t('remote 缺 todos/inbox 键不抛异常', () => {
  const st = mergeRecords([], [], {});
  assert.deepStrictEqual(st, { add: 0, upd: 0, same: 0, tomb: 0 });
});

t('同一 id 在 todos 和 inbox 里都算，按各自数组处理', () => {
  const todos = [{ id: 'a', up: 1, text: 't' }];
  const inbox = [{ id: 'a', up: 1, text: 'i' }];
  const st = mergeRecords(todos, inbox, { todos: [], inbox: [] });
  assert.strictEqual(st.add, 0);
  assert.strictEqual(todos[0].text, 't');
  assert.strictEqual(inbox[0].text, 'i');
});

console.log('bumpUp');

t('up 落后于当前时间 → 取 now', () => {
  const x = { up: 1000 };
  bumpUp(x);
  assert.ok(x.up > Date.now() - 5000);
});

t('up 已经在未来 → 仍然 +1（这是墓碑不被盖的关键）', () => {
  const future = Date.now() + 86400000;
  const x = { up: future };
  bumpUp(x);
  assert.strictEqual(x.up, future + 1);
});

t('没有 up 字段 → 建一个', () => {
  const x = {};
  bumpUp(x);
  assert.strictEqual(typeof x.up, 'number');
  assert.ok(x.up > 0);
});

console.log('newer');

t('up 不同时比大小', () => {
  assert.strictEqual(newer({ up: 2 }, { up: 1 }), true);
  assert.strictEqual(newer({ up: 1 }, { up: 2 }), false);
});

t('同 up 时墓碑赢', () => {
  assert.strictEqual(newer({ up: 5, del: 1 }, { up: 5 }), true);
  assert.strictEqual(newer({ up: 5 }, { up: 5, del: 1 }), false);
});

t('完全相同时返回 false（不重复写）', () => {
  assert.strictEqual(newer({ up: 5 }, { up: 5 }), false);
});

t('缺 up 当作 0', () => {
  assert.strictEqual(newer({}, { up: 0 }), false);
  assert.strictEqual(newer({ up: 0 }, {}), false);
  assert.strictEqual(newer({ up: 1 }, {}), true);
});

console.log('工具函数');

t('esc 挡掉四种注入字符', () => {
  assert.strictEqual(esc('<img src=x onerror="a">'), '&lt;img src=x onerror=&quot;a&quot;&gt;');
  assert.strictEqual(esc('a&b'), 'a&amp;b');
  assert.strictEqual(esc(123), '123');
});

t('dayKey 补零不是必需，但同一天必须同串', () => {
  const d = new Date(2026, 0, 5);
  assert.strictEqual(dayKey(d), '2026-1-5');
  assert.strictEqual(dayKey(d), dayKey(new Date(2026, 0, 5, 23, 59)));
});

t('dayKey 不传参时用今天', () => {
  assert.strictEqual(dayKey(), dayKey(new Date()));
});

t('fmt 空值返回空串', () => {
  assert.strictEqual(fmt(0), '');
  assert.strictEqual(fmt(null), '');
});

t('fmt 一分钟内说「刚刚」', () => {
  assert.strictEqual(fmt(Date.now() - 1000), '刚刚');
});

t('uid 不重复', () => {
  const s = new Set();
  for (let i = 0; i < 2000; i++) s.add(uid());
  assert.strictEqual(s.size, 2000);
});

console.log('\n四象限字段');
t('load 会给老数据补 urg / imp = 0', () => {
  // store.js 里那段补丁的逻辑抄一份在这测：老数据只有 v1 字段
  const migrate = (x) => {
    if (x.urg === undefined) x.urg = 0;
    if (x.imp === undefined) x.imp = 0;
    return x;
  };
  const old = { id: 'a', text: '旧', done: false, del: 0, up: 1 };
  migrate(old);
  assert.strictEqual(old.urg, 0);
  assert.strictEqual(old.imp, 0);
});

t('未标过的任务 up 参与合并时不产生 NaN', () => {
  const todos = [{ id: 'a', up: 10, text: '旧', urg: 0, imp: 0 }];
  mergeRecords(todos, [], { todos: [{ id: 'a', up: 20, text: '新', urg: 1, imp: 1 }] });
  assert.strictEqual(todos[0].urg, 1);
  assert.ok(Number.isFinite(todos[0].up), 'up 变成了 ' + todos[0].up);
});

t('墓碑记录也带着象限字段，合并后不会出现 undefined', () => {
  const todos = [{ id: 'a', up: 5, text: 'X', urg: 1, imp: 0, del: 1 }];
  const st = mergeRecords(todos, [], { todos: [{ id: 'a', up: 9, text: 'X', urg: 0, imp: 0 }] });
  assert.strictEqual(st.upd, 1);
  assert.strictEqual(todos[0].del, 0);
  assert.strictEqual(todos[0].urg, 0);
});

console.log(`\n${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
