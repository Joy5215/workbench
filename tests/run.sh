#!/usr/bin/env bash
# 一键跑全部检查。在 工作台/ 目录下执行：bash tests/run.sh
set -u
cd "$(dirname "$0")/.." || exit 1
PARENT="$(cd .. && pwd)"
PORT="${PORT:-8899}"
FAIL=0

hr(){ printf '%s\n' "----------------------------------------"; }

hr; echo "1/5  构建一致性（dist 是否等于 src 拼出来的）"
if python3 build.py --check; then echo "  ✅ 通过"; else echo "  ❌ dist 与 src 不一致 → python3 build.py"; FAIL=1; fi

hr; echo "2/5  core.js 单元测试"
if node tests/core.test.cjs | tail -2; then :; fi
node tests/core.test.cjs >/dev/null 2>&1 || { echo "  ❌ 有失败用例"; FAIL=1; }

hr; echo "3/5  行为等价（基线 vs 构建，真浏览器跑同一组操作）"
( cd "$PARENT" && python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 ) &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
for _ in 1 2 3 4 5 6 7 8 9 10; do
  curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 0.4
done
if PORT="$PORT" node tests/equivalence.cjs >/tmp/eq.out 2>&1; then
  grep -E '^✅|todos:' /tmp/eq.out | sed 's/^/  /'
  echo "  ✅ 通过"
else
  echo "  ❌ 与基线的行为不一致"
  sed 's/^/  /' /tmp/eq.out | tail -20
  FAIL=1
fi

hr; echo "4/5  四象限交互（真浏览器点一遍）"
if PORT="$PORT" node tests/quad.test.cjs >/tmp/quad.out 2>&1; then
  tail -2 /tmp/quad.out | sed 's/^/  /'
  echo "  ✅ 通过"
else
  echo "  ❌ 四象限交互不符预期"
  sed 's/^/  /' /tmp/quad.out | tail -24
  FAIL=1
fi

hr; echo "5/5  GitHub 通道与链接收件"
if PORT="$PORT" node tests/gh.test.cjs >/tmp/gh.out 2>&1; then
  tail -2 /tmp/gh.out | sed 's/^/  /'
  echo "  ✅ 通过"
else
  echo "  ❌ 收件入口或 GitHub 配置不符预期"
  sed 's/^/  /' /tmp/gh.out | tail -26
  FAIL=1
fi

hr
if [ "$FAIL" -eq 0 ]; then
  echo "全部通过：构建一致 · 单测全绿 · 与基线行为等价 · 四象限交互正确 · 收件入口正确"
  echo "注：等价只覆盖「常规增删 + 视图切换」，墓碑竞态那条已按 bug 修复，与基线不再逐字等价。"
else
  echo "有失败项，别发布。"
fi
exit "$FAIL"
