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
### ✅ 已完成
- [x] 有时切换到布料管理页看不到数据 → 已修复：加入 dataReady 事件机制 + _initialized 防重复
- [x] 图片存储迁移到 Supabase Storage → 已实现后台自动迁移（需先在 Supabase 创建 images bucket）
- [x] icon-192.png / icon-512.png 缺失 → 已生成
- [x] scraps 报废记录上云 → 已接入 data-layer 云端同步（需先在 Supabase 创建 scraps 表）

### 🔄 进行中/待测试
- [ ] 手机端响应式细调（优先级低）
  - 汉堡菜单已实现，需在不同尺寸设备上测试布局
  - 网格适配已实现，需检查表格和表单元素的显示效果
  - 触摸操作体验需在真机上验证

### 📋 计划中
- [x] 添加数据导出/导入功能 → 已实现（exportAll/importAll）
- [x] 离线数据同步机制（方案二：防丢失+提示）→ 已实现
  - 云端写操作失败时兜底写回 localStorage，避免数据静默丢失
  - 失败时弹 Toast 提示用户（带防抖）
  - 注：不含自动重放队列，联网后需重新编辑保存一次才会同步上云
- [ ] 添加数据统计分析图表
- [ ] 优化图片上传和管理界面

### 🐛 Bug 修复记录
- [x] 导入数据后刷新丢失 → 已修复
  - 根因：旧 importAll 是"发射后不管"，触发异步写入后立即返回成功；且用 insert 遇重复 id 静默失败，数据从未真正入库，刷新后 loadFromCloud 拉云端即丢失
  - 修复：importAll 改为 async，逐表批量 upsert（按主键冲突则更新），await 等云端真正写完再返回真实结果；products 关联表先删后插；兜底写本地；失败明确提示

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

## 文档维护要求
**重要：每次项目变更后必须更新此文档并推送到GitHub！**

### 更新时机
- 每次完成新功能开发后
- 每次修复重要bug后
- 每次架构调整后
- 每次Kiro工作会话结束前

### 更新内容
1. **更新"最近更新记录"**（见下方）
2. **更新"已知问题/TODO"**的状态标记
3. **更新相关架构说明**（如有变更）
4. **记录重要决策和原因**

### 为什么需要这样做
- 确保Kiro在下一次打开项目时能立即了解项目状态
- 便于团队协作和知识传承
- 避免重复工作和信息断层

### Kiro自动推送要求
**规则：每次完成代码更新后，Kiro必须：**
1. 检查所有变更文件状态
2. 提交变更到本地git仓库
3. 自动推送到GitHub远程仓库
4. 验证推送是否成功
5. 更新此文档的记录部分

**例外情况：**
- 如果网络连接失败，记录错误并提示用户手动推送
- 如果git配置问题，优先修复配置再继续
- 如果文件冲突，提醒用户处理冲突后再推送

## 最近更新记录
### [2026-07-16] - 修复导入数据不入库的 bug
**主要内容**:
- 重写 data-layer.js 的 importAll：async + 逐表批量 upsert + await 真正写完
- 解决重复 id 导入冲突（insert → upsert）、导入结果如实反馈
- products 关联表 product_fabrics 先删后插避免重复；兜底写本地
**Git状态**: ✅ 已推送

### [2026-07-09] - 离线数据同步（方案二）
**主要内容**:
- 在 data-layer.js 中为所有云端写操作（add/update/remove，含 product_fabrics）加入失败处理
- 新增 runSync/persistLocal/notifySyncError：失败时兜底写本地 + Toast 提示，避免数据静默丢失
- 同时捕获 supabase 返回 error 和断网 reject 两种失败
- 采用防丢失+提示方案，不含自动重放队列

**Git状态**: ✅ 已推送
**待办**: 排查"导入数据后刷新丢失"的 bug

### [2026-07-07] - 文档维护流程建立
**提交ID**: 14fd63e
**主要内容**:
- 建立文档维护流程，明确每次变更后必须更新此文档
- 添加Kiro自动推送要求，每次代码更新后自动推送到GitHub
- 优化"已知问题/TODO"章节，使用状态图标区分任务
- 记录Git环境配置完成状态和Kiro可用性验证

**Git状态**: ✅ 提交成功推送到GitHub远程仓库
**环境配置**: Git已正确安装到E:\Git并配置到系统PATH
**Kiro推送验证**: ✅ 已验证Kiro可以自动完成commit和push操作
**自动推送要求**: 已添加到文档维护规则中

### [2026-07-06] - 重构完成
**提交ID**: 5375639
**主要内容**:
- 重构index.html主页面结构，提升代码组织和可维护性
- 优化auth.js认证模块，改进错误处理和用户体验
- 增强data-layer.js数据层，完善内存与云端同步机制
- 更新manifest.json PWA配置，添加新图标支持
- 新增PROJECT-STATUS.md项目状态文档，记录架构细节
- 添加icon-192.png和icon-512.png PWA应用图标
- 改进响应式设计，优化移动端体验

**Git状态**: ✅ 本地提交已推送至GitHub
**环境配置**: Git已正确安装到E:\Git并配置到系统PATH
**Kiro可用**: ✅ 完全支持Git操作
