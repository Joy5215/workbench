/* ---------- core.js ----------
   纯函数层：不碰 DOM、不碰 localStorage、不碰文件系统。
   唯一目的是能脱离浏览器单测——合并算法（mergeRecords）昨晚错过三次。
   浏览器里这些都以函数声明存在，会被提升，调用顺序无关。 */

var WK = ['日','一','二','三','四','五','六'];

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }


/* 删除要盖过另一台设备上「那个更晚的修改」，否则删掉的东西会自己回来。
   所以墓碑的时间戳不是「现在」，是「现在和旧 up 里更大的那个 + 1」。 */
function bumpUp(x){
  x.up = Math.max(Date.now(), (x.up || 0) + 1);
}


/* 墓碑赢过同 up 的修改，也赢过 up 更小的修改。
   不同步的删除会「复活」：B 设备那条旧记录的 up 只要比墓碑大，就会盖回来。 */
function newer(a, b){
  var ua = a.up || 0, ub = b.up || 0;
  if (ua !== ub) return ua > ub;
  if (!!a.del !== !!b.del) return !!a.del;
  return false;
}

/* 合并：同 id 比 up，大的赢；本地没有的直接收下。墓碑也是记录，一样参与比较。
   纯函数：只改传入的两个数组，不碰全局 S —— 这样能离开浏览器跑用例。
   注意 lmap 只在开头建一次，不随 push 更新，这是原实现的行为，别改。 */
/* 第三个参数 notes 是可选的。不传就照老样子只合 todos + inbox，
   tests/core.test.cjs 里那些用例因此不用改，也不会因为多了一个数组而失败。 */
function mergeRecords(todos, inbox, remote, notes){
  var lmap = {};
  todos.forEach(function(x){ lmap[x.id] = x; });
  inbox.forEach(function(x){ lmap[x.id] = x; });
  if (notes) notes.forEach(function(x){ lmap[x.id] = x; });

  var st = { add:0, upd:0, same:0, tomb:0 };
  var groups = [{ arr: remote.todos || [], to: todos },
                { arr: remote.inbox || [], to: inbox }];
  if (notes) groups.push({ arr: remote.notes || [], to: notes });
  groups.forEach(function(g){
    g.arr.forEach(function(r){
      if (!r || !r.id) return;
      var l = lmap[r.id];
      if (!l) { g.to.push(r); st.add++; return; }
      if (newer(r, l)) {
        Object.keys(r).forEach(function(k){ l[k] = r[k]; });
        if (r.del) {
          st.tomb++;
        } else {
          /* 远端这条「更晚」且没带 del 字段，说明它在那台设备上还活着。
             原来的写法只覆盖远端有的键，本地那个 del:1 会留在原地 ——
             记录内容更新了，却永久藏在墓碑里，等于凭空丢一条。
             场景：A 删了它，B 在收到删除之前又编辑了一版并同步，B 的 up 更大。 */
          if (l.del) l.del = 0;
          st.upd++;
        }
      } else {
        st.same++;
      }
    });
  });
  return st;
}

/* ---------- 时间 ---------- */
function fmt(ts){
  if (!ts) return '';
  var d = new Date(), diff = d.getTime() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff/60000) + ' 分钟前';
  var t = new Date(ts);
  var sameDay = t.toDateString() === d.toDateString();
  if (sameDay) return Math.floor(diff/3600000) + ' 小时前';
  var y = new Date(d.getTime() - 86400000);
  if (t.toDateString() === y.toDateString()) return '昨天';
  return (t.getMonth()+1) + ' 月 ' + t.getDate() + ' 日';
}

function todayLine(){
  var d = new Date();
  return d.getFullYear() + ' 年 ' + (d.getMonth()+1) + ' 月 ' + d.getDate() + ' 日 · 星期' + WK[d.getDay()];
}

function dayKey(d){
  d = d || new Date();
  return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
}

function weekStart(){
  var d = new Date();
  var w = d.getDay() === 0 ? 7 : d.getDay();   // 周一为一周开始
  var m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - w + 1);
  return m.getTime();
}

function esc(s){
  return String(s).replace(/[&<>"]/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
  });
}

/* node 测试用的出口。浏览器里 module 不存在，这段整体跳过，不产生任何副作用。 */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { uid: uid, bumpUp: bumpUp, newer: newer, mergeRecords: mergeRecords,
                     fmt: fmt, todayLine: todayLine, dayKey: dayKey, weekStart: weekStart,
                     esc: esc };
}
