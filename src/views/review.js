/* ---------- views/review.js ----------
   回顾：只看三个数——积压有没有在涨。数字多了就没人看了。 */

function viewReview(){
  var ws = weekStart();
  var today = new Date().toDateString();
  var doneToday = 0, doneWeek = 0;
  S.todos.forEach(function(t){
    if (t.del || !t.done || !t.doneAt) return;
    if (new Date(t.doneAt).toDateString() === today) doneToday++;
    if (t.doneAt >= ws) doneWeek++;
  });
  var inboxOpen = S.inbox.filter(function(x){ return !x.del; }).length;

  return '<div class="wrap">' + uiHead('回顾', '不追数字，只看积压有没有在涨')
    + '<div class="stats">'
    + uiStat(doneToday, '今天完成', true)
    + uiStat(doneWeek, '本周完成')
    + uiStat(inboxOpen, '收件箱积压')
    + '</div>'
    + uiSoon('这一版只有这三个数',
        '下一版会加：连续完成天数、每条待办从记下到完成用了多久、以及「积压超过 7 天的条目」自动浮出来。'
        + '<b>现在先不加</b>——数字多了就没人看了。')
    + '</div>';
}

VIEW_FN.review = viewReview;
