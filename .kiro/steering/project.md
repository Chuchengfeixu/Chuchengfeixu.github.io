---
inclusion: always
---

# 缝纫信息管理系统 · 项目引导（Kiro Steering）

> 本文件由 Kiro 每次会话自动加载，用于快速进入工作状态。
> **只放稳定信息**（项目定位、技术栈、约定、导航）；易变的当前焦点/待办不写这里。

## ⭐ 会话开始第一步
先读工作区根目录的 **`PROJECT-STATUS.md`**，了解「当前焦点 + 待办清单（TODO）」再动手。
- 该文件是本地文件（已加入 .gitignore，不推送 GitHub），但在 `d:\Sewing` 本地存在，可正常读取。
- 待办按 P1 工程化 / P2 产品运营 / 功能计划 / 进行中 Spec 分组，统一 `- [ ]` 格式，集中在文件最上方。

## 项目定位
- 缝纫数据管理单页应用：布料 / 制品 / 纸样 / 辅料的本地 + 云端同步，含社区作品展示与付费配额。
- 前端：纯 HTML/JS/CSS，**无构建工具**（CDN 直引，`<link>` / `<script src>` 顺序加载）。
- 后端：Supabase（数据库 + 认证 + Storage）。部署：GitHub Pages。
- **dev/prod 隔离**：两个 Supabase 项目。本地 `file://`/`localhost` 连 staging，线上 `github.io` 连 prod（切换逻辑在 `js/supabase-config.js` 的 `detectSupabaseEnv()`）。前端代码写一份两环境通用；DB 结构改动须两库各执行（staging 先验证再同步 prod）。

## 文件结构（主）
- `index.html` — 页面结构 + SVG sprite + 启动脚本（样式/主逻辑已外链）
- `css/styles.css` — 全部样式
- `js/app.js` — 主业务逻辑（各 Controller / Store / UI / svgIcon）
- `js/data-layer.js` — 数据层：IIFE 覆盖全局 `Store`，内存读取 + 后台同步 Supabase
- `js/supabase-config.js` / `js/auth.js` / `js/auth-ui.js` — 配置与认证
- `sw.js` — Service Worker（PWA 缓存，新增静态资源要同步进缓存清单并升版本号）
- `db/migrations/` — 数据库结构变更 SQL（约定见其 README；改 DB 结构须 staging 先跑再同步 prod）

## 关键约定 / 易踩坑
- **`const` 声明的对象（如 `Auth` / `ImageStore`）必须显式挂 `window.`** 才能被 data-layer / inline onclick 访问，否则静默拿到 undefined（曾致 image_url 存空）。
- 社区等"他人输入"字段渲染前必须走 **`escapeHtml`**（XSS 防护）。
- 安全全靠 **Supabase RLS**（anon key 是公开的），改后端表/策略要保证 RLS 覆盖。
- 图标：内联 SVG sprite + `window.svgIcon(name, cls)`，`.icon{fill:none;stroke:currentColor}` 继承颜色。
- 编码：源文件保持 UTF-8 BOM + CRLF，改动勿破坏。

## 📌 维护规则（重要）
- **每次完成变更后**：更新 `PROJECT-STATUS.md` 的「当前焦点 / 待办清单」（勾掉已完成、补新待办）。**这是每次都要做的。**
- **本 steering 文件**：仅当*架构 / 文件结构 / 技术栈 / 关键约定*发生变化时才更新，平时不动。
- 不要把易变的进度日志写进本文件；日志类信息不再长期保留（详见 PROJECT-STATUS.md 顶部说明）。
