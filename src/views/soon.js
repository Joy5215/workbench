/* ---------- views/soon.js ----------
   还没做的视图。新增一个功能时，先从 VIEWS 里注册它、再写 views/<k>.js；
   在写之前它自动落到这里，不需要在别处加分支。 */

var SOON_CFG = {
  projects:{h:'项目', s:'把待办归到项目下，按项目看进度', ic:'folder',
    next:'项目 = 一组相关待办的容器。你可能想：「Q4 复盘」下面挂 5 件事，做完 3 件就显示 60%。'},
  notes:{h:'笔记', s:'比待办长、比文档短的东西', ic:'note',
    next:'和收件箱的区别：收件箱是「还没想清楚的一句话」，笔记是「已经想清楚、要留存的一段」。合并、打标签、全文搜索都在这一版之后。'}
};

function viewSoon(kind){
  var cfg = SOON_CFG[kind] || {h:kind, s:'', ic:'note', next:''};
  return '<div class="wrap">' + uiHead(cfg.h, cfg.s)
    + uiSoon('这一版先不做', cfg.next + '<br><br>先让你把已有功能用起来。'
        + '这块该长什么样，得看你怎么用别的部分——现在做，只能靠我猜。')
    + '</div>';
}
