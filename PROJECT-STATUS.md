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
- [x] 图片存储迁移到 Supabase Storage → 已实现后台自动迁移（✅ 公开 images bucket 已在 Supabase 创建）
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
- [ ] 添加数据统计分析图表（并入 community-and-monetization spec 的 Pro 付费点）
- [ ] 优化图片上传和管理界面
- [x] **全局图标统一（方案 A + 中性深灰为主）** → 已完成（2026-07-24）
  - 最终方案：“能删就删”——紧贴文字标签的装饰 emoji 全部删除（导航、页标题、数据按钮、看板卡片标题、空状态、搜索结果、作品详情前缀等）
  - 仅保留 3 个单色 SVG（高频纯图标按钮，文字会撑爆行宽）：编辑/删除/齿轮(管理选项)；低频的发布/再做一件/完成已改为文字按钮
  - 实现：`<body>` 后内联 SVG sprite（`<symbol id="i-*">`）+ `.icon{fill:none;stroke:currentColor}` + `window.svgIcon(name,cls)` helper；图标用 `currentColor` 继承文字/按钮颜色（导航继承深灰，卡片按钮沿用各模块主题色变量）
  - 其它单色字符保留：`☰`(列表)/`▦`(卡片)/`⬇ ⬆`(展开收起)/`✕`(移除)/`★`(评分)/`↺`(撤销)；品牌 logo `🧵`、点赞/收藏 `❤⭐`、Toast `🎉⚠️`、付费引导图标保留
  - 已本地验证：sprite 符号全在、svgIcon 正常、图标 16×16 stroke=#2C2C2C fill=none、无控制台报错
- [ ] **制品-辅料联动（独立后续功能）**
  - 背景：目前制品仅通过 product_fabrics 关联布料，辅料(notions)是独立库存表，无"制品用了哪些辅料"的关联
  - 需要：新增 product_notions 关联表 + 制品表单增加"添加辅料用量"交互（类比现有布料用量）
  - 价值：让成本核算能纳入辅料（当前 community-and-monetization spec 的成本口径仅算布料 fabric-only，待此功能上线后升级为 fabric+notion）
  - 优先级：中，牵扯制品录入流程，与社区/付费主线独立，单独排期

### 🚧 进行中的 Spec
- [ ] **community-and-monetization**（社区作品展示 + 付费功能）
  - 需求 ✅ / 设计 ✅ / 任务执行中（9/18）
  - 模块一：制品一键发布为公开作品、Feed 浏览、点赞、收藏（快照隔离私有数据）
  - 模块二：第一批付费点 = 图片月度配额(免费 20 张/月) + 数据统计分析(Pro)
  - 成本口径：方向 A 仅算布料（fabric.price 为整匹总价，每米单价 = price/meters）
  - 进度：16/18（代码全部完成，剩 17-18 手动验证）
  - 已完成：
    - 任务1-3 Supabase 后端（表 showcase_posts/post_likes/post_favorites/image_usage_monthly + RLS + RPC check_and_increment_image_quota/get_image_usage + 计数触发器），SQL 存于 spec/supabase-setup.sql，已在 Supabase 执行验证
    - 任务4-7 data-layer.js：buildSnapshot/computeCost/resolvePatternPublicInfo、resolvePublicImageUrl（idb图片转云端）、CommunityStore（发布/更新/取消/公开切换/删除/Feed/详情/我的作品/收藏/点赞/收藏）、QuotaService
    - 任务8 auth.js：Auth.requirePro(featureKey) 门禁；updateUserDisplay 增加档位到期+本月图片配额展示
    - 任务9 index.html：Paywall 升级引导组件
    - 任务10：9处图片上传入口接入 guardImageUpload 配额校验（导入/迁移不占额）
    - 任务11：制品卡片"发布为作品"入口 + 发布弹窗（标题/描述/成本公开开关）
    - 任务12-14：社区页（广场/我的作品/我的收藏三标签）+ 路由 + 导航 + 作品详情弹窗（点赞/收藏/更新快照/公开切换/删除）+ CommunityController
    - 任务15：看板 Pro 数据分析卡片（免费模糊预览+升级引导；Pro 展示库存成本/已消耗成本/周转率）
    - 任务16：侧边栏账户区展示档位与本月图片配额
  - 待办（手动验证）：
    - 任务17 RLS/RPC 安全验证（多账号交叉验证隔离性、配额边界）
    - 任务18 端到端流程验证（发布→Feed→点赞收藏→取消公开→更新作品→成本保密）
  - ✅ 部署前提已满足：Supabase Storage 公开 images bucket 已创建（2026-07-24，社区作品图片依赖，发布时把本地 idb 图片上传至此）

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
### [2026-07-24] - 全局图标精简（能删就删 + 3个单色SVG）+ 图片上传失败改为明确报错
**主要内容**:
- 全局图标：绝大多数紧贴文字的装饰 emoji 直接删除（导航/页标题/数据按钮/看板标题/空状态/搜索结果/作品详情前缀等）；图标集精简至 3 个单色 SVG（编辑/删除/齿轮），发布/再做一件/完成改为文字按钮
  - 新增内联 SVG sprite + `.icon{fill:none;stroke:currentColor}` + `window.svgIcon()` helper（详见"计划中"该条目）
  - 已用浏览器本地验证：符号齐全、渲染 16×16、继承 currentColor、无报错
- `data-layer.js`：`resolvePublicImageUrl` 从"失败静默返回空串"改为**有图但处理失败时 throw**（模块未就绪/本地缺图/上传失败三类明确文案），`publishPost`/`updatePost` catch 后返回 `{ok:false,error}`，UI 现有 Toast 直接显示原因，避免 image_url 再次静默存空
**待办 / 注意**:
  - 工作区 `spec/supabase-setup.sql` 已由用户刻意删除（不再需要），本次提交连同此删除一起提交
  - 社区图片"发布时 image_url 为空"已好转（用户侧修复）；根因排查指向 Storage `storage.objects` INSERT 策略缺失
**Git状态**: ⏳ 待推送
### [2026-07-24] - bucket 就绪 + 社区图片修复 + 成本只显示总额
**主要内容**:
- 公开 `images` bucket 已在 Supabase Storage 创建（满足社区作品图片依赖）
- 任务 11（制品发布/更新入口）确认已实现，tasks.md 勾选对齐
- 修复社区图片不显示（两处叠加，均已解决）：
  - 【主因】`ImageStore` 用 `const` 声明未挂 window，data-layer.js 的 resolvePublicImageUrl
    通过 `window.ImageStore` 访问得到 undefined → idb 图片上传分支被跳过 → 静默返回空串 →
    image_url 存空、不报错、不调 saveToCloud。与此前 window.Auth 未暴露同类坑。
    修复：index.html 在 ImageStore 定义后加 `window.ImageStore = ImageStore;`
  - 【必要前提】Storage 上传策略：public bucket 仅开放匿名读取，经用户 token 上传仍需
    `storage.objects` 的 INSERT 策略。已在 supabase-setup.sql 补充 images bucket 的
    INSERT/SELECT/UPDATE/DELETE 策略（上传限本人目录 `<user_id>/<uuid>.<ext>`），已在 Supabase 执行。
  ⚠️ 此前发布的作品 image_url 已空，需重新发布 / "更新快照" 才会补图。刷新页面时注意 SW 缓存，必要时强刷。
- 社区成本口径调整：只显示最终成本，不再公开布料/辅料明细
  - buildSnapshot 不再写入 fabrics_snapshot（存空数组，避免公开泄露材料构成）
  - 作品详情 UI 移除布料明细行，仅保留纸样(可选)/成本(show_cost 时)/分类
**待办**:
  - 用户在 Supabase 执行新增存储策略 SQL 后，重新发布作品验证社区图片显示
  - 管理员账号 / 第二账号方案（见"计划中"新增条目）
  - community spec 任务 17-18 手动验证（RLS/RPC 安全 + 端到端流程）
**Git状态**: ⏳ 待推送

### [2026-07-23] - community-and-monetization 主体完成 + 登录相关修复
**主要内容**:
- 完成 community-and-monetization spec 代码实现 16/18（详见"进行中的 Spec"）
  - 后端 SQL（表 + RLS + RPC + 触发器）已在 Supabase 执行
  - data-layer.js：CommunityStore / QuotaService / 快照与成本计算 / idb 图片转云端
  - auth.js：requirePro 门禁 + 账户区档位与配额展示
  - index.html：Paywall、9处图片配额守卫、发布入口、社区页(广场/我的作品/我的收藏)、作品详情、看板 Pro 分析卡片
- 修复 bug：
  - window.Auth 未暴露（const 不挂 window）导致 getUserId 恒 null → 发布误判"未登录"；已加 window.Auth = Auth
  - 窗口切换/token 刷新重复弹"登录成功"；改为按用户 ID 去重 + 单独处理 TOKEN_REFRESHED
  - 社区图标 🌐→👭；制品发布图标 🌐→📤
**待办**:
  - community spec 任务 17-18 手动验证（安全 + 端到端）
  - 全局图标统一（方案 A + 中性深灰，见"计划中"）
**Git状态**: ✅ 已推送

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
