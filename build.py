#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把 src/ 下的模块拼成单文件 dist/我的工作台.html。

为什么是「拼接」而不是「打包器」：
   产物必须能双击打开、能放进网盘同步空间、断网可用、零依赖。
   任何引入 node_modules 的方案都会破坏这三条。

用法：
   python3 build.py            构建
   python3 build.py --check    只校验 dist 是否与 src 一致（CI/收工用）
"""
import hashlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "src")
OUT = os.path.join(HERE, "dist", "我的工作台.html")

# 顺序即依赖顺序。core 在最前（纯函数），main 在最后（启动）。
ORDER = ["core.js", "store.js", "sync.js", "view.js", "actions.js", "main.js"]


def read(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as f:
        return f.read().rstrip("\n")


def build():
    tpl = read("index.html")
    css = read("style.css")
    parts = []
    for name in ORDER:
        parts.append("/* ================= %s ================= */\n%s" % (name, read(name)))
    js = "\n\n".join(parts)

    if "/* @CSS@ */" not in tpl or "/* @JS@ */" not in tpl:
        sys.exit("模板里缺占位符 @CSS@ / @JS@")
    out = tpl.replace("/* @CSS@ */", css).replace("/* @JS@ */", js)
    return out


def main():
    out = build()
    if "--check" in sys.argv:
        if not os.path.exists(OUT):
            sys.exit("dist 不存在，先跑 python3 build.py")
        cur = open(OUT, encoding="utf-8").read()
        if cur != out:
            sys.exit("dist 与 src 不一致 → python3 build.py")
        print("dist 与 src 一致（%d 字节）" % len(out.encode("utf-8")))
        return

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(out)
    b = out.encode("utf-8")
    print("产出 %s" % os.path.relpath(OUT, HERE))
    print("  %d 字节 / %d 行 / sha256 %s" % (len(b), out.count("\n") + 1,
                                           hashlib.sha256(b).hexdigest()[:12]))


if __name__ == "__main__":
    main()
