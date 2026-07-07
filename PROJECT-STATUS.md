# 缝纫信息管理系统 - 项目状态

## 架构
- 前端：纯 HTML/JS/CSS 单页应用（index.html 为主文件，约7800行）
- 后端：Supabase（数据库 + 认证）
- 部署：GitHub Pages → https://chuchengfeixu.github.io
- 仓库：https://github.com/Chuchengfeixu/Chuchengfeixu.github.io

## 文件结构
- `index.html` - 主页面（包含所有 UI + 大部分 JS 逻辑）
- `js/supabase-config.js` - Supabase 连接配置
- `js/auth.js` - 认证模块（登录/注册/登出）
- `js/auth-ui.js` - 登录注册界面交互
- `js/data-layer.js` - 数据层（覆盖原 Store 对象，内存读取 + 后台同步到 Supabase）
- `sw.js` - Service Worker（PWA 缓存）
- `manifest.json` - PWA 配置

## Supabase 数据库表
- `fabrics` - 布料（含补充列：code, width, purchase_date, printed, printed_at）
- `products` - 制品（含补充列：sewn_by, pattern_source, pattern_id, pattern_type, pattern_code, tutorial_link, quantity）
- `product_fabrics` - 制品-布料关联表
- `todos` - 待做列表（含补充列：category）
- `patterns` - 纸样（含补充列：code, link）
- `notions` - 辅料（含补充列：purchase_date）
- `profiles` - 用户资料（含 role 字段，admin 角色已设置）

## 数据层工作原理
`data-layer.js` 用 IIFE 覆盖全局 `Store` 对象：
- 登录后调 `DataLayer.loadFromCloud()` 一次性拉取所有数据到内存
- `Store.getAll()` 同步从内存返回（不阻塞 UI）
- `Store.add/update/remove` 立即更新内存，后台异步同步到 Supabase
- `scraps`（报废记录）仍存 localStorage，未上云
- 图片仍存本地 IndexedDB，未上云

## 变量命名注意
- Supabase CDN 加载后全局有 `window.supabase`（库对象）
- `supabase-config.js` 创建客户端为 `window.supabaseClient`
- `data-layer.js` 内部通过 `getDB()` 函数获取 `window.supabaseClient`
- `auth.js` 直接使用 `supabaseClient`

## 已知问题 / TODO
- [x] 有时切换到布料管理页看不到数据 → 已修复：加入 dataReady 事件机制 + _initialized 防重复
- [x] 图片存储迁移到 Supabase Storage → 已实现后台自动迁移（需先在 Supabase 创建 images bucket）
- [ ] 手机端响应式已做（汉堡菜单 + 网格适配），可能需要细调
- [x] icon-192.png / icon-512.png 缺失 → 已生成
- [x] scraps 报废记录上云 → 已接入 data-layer 云端同步（需在 Supabase 创建 scraps 表）

## 管理员账号
当前注册账号已设置 `profiles.role = 'admin'`

## Git 推送方式
本地没有 Git GUI，用命令行：
```bash
cd D:\缝纫系统
git add .
git commit -m "提交信息"
git push
```
