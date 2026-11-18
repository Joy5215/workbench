/* ---------- config.js ----------
   配置层：视图清单、图标、枚举。只有数据，没有逻辑。
   加一个视图/一个图标，只改这个文件；别的层不用知道。 */

var IC = {
  today:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="3.3"/><path d="M8 1.3v1.5M8 13.2v1.5M1.3 8h1.5M13.2 8h1.5M3.3 3.3l1 1M11.7 11.7l1 1M12.7 3.3l-1 1M4.3 11.7l-1 1"/></svg>',
  quad:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><rect x="2.2" y="2.2" width="11.6" height="11.6" rx="1.6"/><path d="M8 2.2v11.6M2.2 8h11.6"/></svg>',
  inbox:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M2 9.2V13h12V9.2"/><path d="M2 9.2l2-6h8l2 6"/><path d="M2 9.2h3.2l.9 1.6h3.8l.9-1.6H14"/></svg>',
  folder:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M1.9 12.7V3.8h4.3l1.5 1.9h6.4v7z"/></svg>',
  note:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3.3" y="2.2" width="9.4" height="11.6" rx="1.4"/><path d="M5.7 5.7h4.6M5.7 8.1h4.6M5.7 10.5h3"/></svg>',
  review:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 11.6l3.5-3.9 2.5 2.1 5.3-5.9"/><path d="M2.2 14h11.6"/></svg>',
  pin:'<svg class="pin" viewBox="0 0 16 16"><path d="M8 1.5l1.95 3.95 4.35.63-3.15 3.07.75 4.33L8 11.44 4.1 13.5l.75-4.33L1.7 6.08l4.35-.63z"/></svg>',
  starOn:'<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.9l1.83 3.7 4.09.6-2.96 2.88.7 4.07L8 11.2l-3.66 1.95.7-4.07L2.08 6.2l4.09-.6z"/></svg>',
  starOff:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"><path d="M8 2.4l1.72 3.48 3.85.56-2.79 2.71.66 3.83L8 11.16l-3.44 1.82.66-3.83L2.43 6.44l3.85-.56z"/></svg>',
  x:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4.4 4.4l7.2 7.2M11.6 4.4l-7.2 7.2"/></svg>',
  sync:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5.8 13.8h8.4a3 3 0 0 0 .35-5.98A4.4 4.4 0 0 0 6.05 6.9a3.1 3.1 0 0 0-.25 6.9z"/><path d="M8.2 10.7l1.8-1.8 1.8 1.8"/></svg>',
  arrow:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h9.5M9 4.5L12.5 8 9 11.5"/></svg>',
  /* 四象限小图标：urg=火烧，imp=星，双标=立方体 */
  alert:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.4L14 13H2z"/><path d="M8 6.6v3M8 11.3v.1"/></svg>',
  spark:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.2l1.7 4.1 4.1 1.7-4.1 1.7L8 13.8l-1.7-4.1L2.2 8l4.1-1.7z"/></svg>',
  users:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="5.6" r="2.2"/><path d="M2.2 13c0-2.1 1.7-3.5 3.8-3.5S9.8 10.9 9.8 13"/><path d="M11 4.2a2 2 0 0 1 0 3.6M12.2 9.9c1 .4 1.7 1.5 1.7 3.1"/></svg>',
  cloud:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.6 12.3h7a2.4 2.4 0 0 0 .3-4.8A3.6 3.6 0 0 0 5 6.6a2.5 2.5 0 0 0-.4 5.7z"/></svg>'
};

/* 视图清单。k 是状态值，也是 views/<k>.js 里函数的键。
   newBadge: 该视图在导航上显示什么数字（返回 0 则不显示）。 */
var VIEWS = [
  {k:'quad',   label:'四象限', ic:'quad'},
  {k:'today',  label:'今日',   ic:'today'},
  {k:'inbox',  label:'收件箱', ic:'inbox'},
  {k:'projects', label:'项目', ic:'folder'},
  {k:'notes',  label:'笔记',   ic:'note'},
  {k:'review', label:'回顾',   ic:'review'},
  {k:'sync',   label:'同步',   ic:'sync'}
];

/* 四象限定义。顺序即渲染顺序（左上→右下）。
   每格用 urg / imp 两个布尔值标识自己，记录上的同名字段直接比对。
   c 是这一格的标识色，跟滴答一样只在标题圆点上出现，不铺整块背景。 */
var QUADS = [
  {k:'do',    label:'重要且紧急', urg:1, imp:1, ic:'alert', c:'#e05b4a'},
  {k:'plan',  label:'重要不紧急', urg:0, imp:1, ic:'spark', c:'#d99a1f'},
  {k:'deleg', label:'不重要但紧急', urg:1, imp:0, ic:'users', c:'#3f7fd0'},
  {k:'drop',  label:'不重要不紧急', urg:0, imp:0, ic:'cloud', c:'#8a8f86'}
];

var QUAD_BY = {};
QUADS.forEach(function(q){ QUAD_BY[q.k] = q; });

/* 已实现视图的注册表。views/<k>.js 里把渲染函数塞进这里。
   没注册的视图自动落到「待建设」页，不需要在别处写分支。 */
var VIEW_FN = {};
