# 高性价比人生指南 · 在线阅读版

《高性价比人生指南》的在线阅读版：每条先给一句「说人话」，再展开成本、收益和来源。可按不花钱 / 不费时间 / 不费毅力筛选，本机记录已完成、收藏、已阅和上次阅读位置，可加到手机桌面。

正文全部出自 [eternity4719/HowToLiveBetter](https://github.com/eternity4719/HowToLiveBetter)，按 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.zh-hans) 使用，未改动任何条目文字。本站是非官方站，以原仓库中文原文为准；纠错和补充请去原仓库提 issue。

## 怎么跑

纯静态，没有后端。`tools/build.mjs` 每天由 GitHub Actions 从上游 `book/*.md` 生成 `book.json` 和 `docs.json`，`index.html` 读这两个文件。

```bash
python3 -m http.server 8000      # 本地看效果，打开 http://localhost:8000/

git clone --depth 1 https://github.com/eternity4719/HowToLiveBetter /tmp/up
node tools/build.mjs /tmp/up book.json   # 手动重新生成
```

## 许可

正文 CC BY 4.0（版权归原作者）。本仓库的页面和脚本 MIT，见 LICENSE。
