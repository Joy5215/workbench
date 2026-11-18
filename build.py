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

# 顺序即依赖顺序：纯函数 → 配置 → 数据 → UI 组件 → 各视图 → 路由 → 动作 → 启动。
# 加一个视图：在 config.js 的 VIEWS 里注册，再在 VIEWS_FILES 里加一行 views/<k>.js。
ORDER = [
    "core.js",      # 纯函数，能被 node 单测
    "config.js",    # 视图清单、图标、四象限定义
    "store.js",     # localStorage 与探测
    "sync.js",      # 文件夹同步
    "sync-gh.js",   # GitHub 通道（全平台，含手机）
    "media.js",     # 媒体识别：视频/图片/外站卡片
    "ui.js",        # 通用组件
]
VIEWS_FILES = [
    "views/today.js",
    "views/quad.js",
    "views/inbox.js",
    "views/review.js",
    "views/notes.js",  # 笔记：视频/文档来源 + Markdown + mermaid
    "views/soon.js",   # 给未实现的视图兜底（不注册到 VIEW_FN）
]
TAIL = [
    "render.js",    # 路由与装配
    "actions.js",   # 写操作
    "main.js",      # 启动
]


VENDOR_FILES = [
    "vendor/marked.min.js",    # Markdown 解析（MIT）
    "vendor/purify.min.js",    # HTML 净化（Apache-2.0），防笔记里的 script 执行
]


def read(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as f:
        return f.read().rstrip("\n")


def build():
    tpl = read("index.html")
    css = read("style.css")
    parts = []
    # 第三方库用裸字符串，不加分隔注释（它们自己就有 license 头）
    for name in VENDOR_FILES:
        parts.append(read(name))
    for name in ORDER + VIEWS_FILES + TAIL:
        parts.append("/* ================= %s ================= */\n%s" % (name, read(name)))
    js = "\n\n".join(parts)

    if "/* @CSS@ */" not in tpl or "/* @JS@ */" not in tpl:
        sys.exit("模板里缺占位符 @CSS@ / @JS@")
    out = tpl.replace("/* @CSS@ */", css).replace("/* @JS@ */", js)

    # PWA：只有当 manifest 与 service worker 两个文件都在时才注入。
    # 单文件产物（双击打开）不该引用不存在的文件，否则控制台永远两条 404。
    mf = os.path.join(SRC, "manifest.webmanifest")
    sw = os.path.join(SRC, "sw.js")
    if os.path.exists(mf) and os.path.exists(sw):
        head = ('<link rel="manifest" href="manifest.webmanifest">\n'
                '<link rel="apple-touch-icon" href="icon-192.png">\n'
                '<meta name="apple-mobile-web-app-capable" content="yes">\n'
                '<meta name="apple-mobile-web-app-title" content="工作台">')
        out = out.replace("<title>", head + "\n<title>", 1)
        # 注册代码单独一个 <script>，放在 IIFE 外面
        hook = ("if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {\n"
                "  addEventListener('load', function(){ navigator.serviceWorker.register('sw.js')"
                ".catch(function(){}); });\n}")
        out = out.replace("</body>", "<script>\n%s\n</script>\n</body>" % hook, 1)
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
