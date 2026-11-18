/* ---------- views/inbox.js ----------
   收件箱：只负责接住，不负责整理。每条只有两个出口——转待办，或者删。 */

function viewInbox(){
  var list = S.inbox.filter(function(x){ return !x.del; })
    .sort(function(a,b){ return b.created - a.created; });
  var h = '<div class="wrap">' + uiHead('收件箱', list.length
      ? list.length + ' 条待清理 · 想到什么先丢进来'
      : '想到什么先丢进来，不用当时就决定')
    + uiEntry('记一笔…', '记下');

  if (list.length) {
    h += '<div class="list">' + list.map(inboxRow).join('') + '</div>';
  } else {
    h += '<div class="list">' + uiEmpty('inbox', '收件箱是空的',
      '这里是「先接住，回头再理」的地方。写一句就够，不必完整。') + '</div>';
  }
  h += uiFoot('清理节奏：每条只有两个出路——变成待办，或者删掉。别让它堆成第二份待办。');
  return h + '</div>';
}

VIEW_FN.inbox = viewInbox;
