/* ---------- views/quad.js ----------
   四象限：把同一批待办按「重要 × 紧急」切开。不是另一份数据，只是另一个视角。

   为什么用两个独立布尔字段而不是一个 quadrant 字符串：
   一条任务「重要」这件事本身有含义（四象限在哪个格子是推论，不是属性）。
   存两个布尔，以后加筛选、加排序都能直接用；存字符串则是把推论当真相。

   没标过的任务落在「不重要不紧急」——那格的语义就是「还没想清楚该不该做」，
   正好是未分类任务的归宿，不需要再造一个「未分类」格子。
*/

function quadOf(t){ return (t.urg ? 'u' : '-') + (t.imp ? 'i' : '-'); }

function viewQuad(){
  var open = S.todos.filter(function(t){ return !t.del && !t.done; });
  var doneN = S.todos.filter(function(t){ return !t.del && t.done; }).length;

  var h = '<div class="wrap">' + uiHead('四象限',
      open.length ? open.length + ' 件待安排' + (doneN ? ' · 已完成 ' + doneN : '')
                  : '还没有待办')
    + '<div class="quad">';

  QUADS.forEach(function(q){
    var items = open.filter(function(t){ return quadOf(t) === (q.urg ? 'u' : '-') + (q.imp ? 'i' : '-'); });
    items.sort(function(a,b){ return (b.star - a.star) || (b.created - a.created); });

    h += '<div class="qc' + (q.k === 'do' ? ' hot' : q.k === 'plan' ? ' warm' : '') + '" data-q="' + q.k + '">'
      + '<div class="qh"><span class="qi">' + (IC[q.ic] || '') + '</span>'
      + '<span class="qt">' + esc(q.label) + '</span>'
      + '<span class="qn">' + (items.length || '') + '</span></div>';

    if (items.length) {
      h += '<div class="list">' + items.map(function(t){
        return '<div class="row" data-id="' + t.id + '">'
          + '<button class="cb" data-tog="' + t.id + '" aria-label="完成"></button>'
          + '<div class="tx"><div class="t">' + (t.star ? IC.pin : '') + esc(t.text) + '</div></div>'
          + '<div class="act">'
          + '<button data-urg="' + t.id + '" class="' + (t.urg ? 'on u' : '') + '" title="紧急">急</button>'
          + '<button data-imp="' + t.id + '" class="' + (t.imp ? 'on i' : '') + '" title="重要">重</button>'
          + '<button class="del" data-del="' + t.id + '" title="删除">' + IC.x + '</button>'
          + '</div></div>';
      }).join('') + '</div>';
    }

    /* 每格都能直接加一件，加进去就带这一格的标记 */
    h += '<div class="entries"><div class="qform">'
      + '<input type="text" data-qin="' + q.k + '" placeholder="加一件…" autocomplete="off">'
      + '<button class="qadd" data-addq="' + q.k + '">+</button>'
      + '</div></div></div>';
  });

  return h + '</div></div>';
}

VIEW_FN.quad = viewQuad;
