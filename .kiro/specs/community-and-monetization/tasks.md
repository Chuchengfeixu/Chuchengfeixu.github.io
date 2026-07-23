# Implementation Plan

## Overview

本计划把设计的 18 项改动拆为可执行任务，分四阶段：后端基础（Supabase）→ 数据层与认证 → UI → 验证。

标注 🗄️ 的任务需在 Supabase 控制台执行 SQL（会整理完整脚本供手动运行）；其余为前端代码改动。建议按阶段顺序推进：先建后端基础，再接数据层，最后做 UI 与验证。

## Task Dependency Graph

按依赖关系分波次（同一波次内的任务可并行）：

```json
{
  "waves": [
    { "wave": 1, "tasks": [1], "description": "建表，无前置依赖" },
    { "wave": 2, "tasks": [2, 3], "description": "RLS 与 RPC/触发器，依赖建表" },
    { "wave": 3, "tasks": [4, 7, 8], "description": "快照/成本、配额服务、Auth门禁，依赖后端就绪" },
    { "wave": 4, "tasks": [5, 6, 9], "description": "CommunityStore、互动、Paywall" },
    { "wave": 5, "tasks": [10, 11, 12, 15, 16], "description": "上传配额接入、发布入口、Feed、统计分析、账户区" },
    { "wave": 6, "tasks": [13, 14], "description": "作品详情、我的作品/收藏" },
    { "wave": 7, "tasks": [17, 18], "description": "安全验证与端到端验证" }
  ]
}
```

依赖要点：任务 4 依赖 1；5/6 依赖 2、4；7 依赖 1、3；9 依赖 8；10 依赖 7、9；12/13/14 依赖 5/6；15/16 依赖 7/8；17/18 依赖前述全部完成。

## Tasks

### 阶段一：后端基础（Supabase）

- [x] 1. 🗄️ 创建社区与配额相关数据表
  - 创建 `showcase_posts`（快照表：user_id, product_id, title, description, image_url, category, finish_date, fabrics_snapshot jsonb, pattern_snapshot jsonb, cost_snapshot jsonb, show_cost, is_public, like_count, favorite_count, created_at, updated_at）
  - 创建 `post_likes`（post_id, user_id, created_at；主键 (post_id, user_id)）
  - 创建 `post_favorites`（同结构；主键 (post_id, user_id)）
  - 创建 `image_usage_monthly`（user_id, month text, count int；主键 (user_id, month)）
  - 确认 `profiles` 含 tier 与 tier_expires_at 字段，缺则补充
  - _Requirements: 1.2, 4.5, 5.5, 8.1, 7.1_

- [x] 2. 🗄️ 配置 RLS 策略
  - showcase_posts：select 允许 `is_public = true OR user_id = auth.uid()`；insert/update/delete 限 `user_id = auth.uid()`
  - post_likes / post_favorites：select 公开，写入限 `user_id = auth.uid()`
  - image_usage_monthly：仅本人可 select，写入只经 RPC
  - 复核 fabrics/products/product_fabrics/patterns/notions/scraps 私有表 RLS 保持"仅本人可读写"不变
  - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - _Properties: P1_

- [x] 3. 🗄️ 创建配额 RPC 与计数触发器
  - RPC `check_and_increment_image_quota()`：security definer，读 profiles.tier（含过期判断），Pro 不限额；免费当月 count 达 20 拒绝，否则原子 +1；返回 { allowed, used, limit }
  - 触发器：post_likes/post_favorites 增删时同步 showcase_posts.like_count/favorite_count
  - _Requirements: 8.2, 8.3, 8.7, 4.1, 4.2, 5.1, 5.3_
  - _Properties: P2, P3_

### 阶段二：数据层与认证（js/data-layer.js, js/auth.js）

- [x] 4. 实现快照聚合与成本计算辅助函数
  - `buildSnapshot(product, options)`：聚合公开字段（名称/图片/分类/完成日期/布料用量快照/纸样快照），show_cost 时含 cost_snapshot
  - `computeCost(product)`：仅布料口径，每米单价 = fabric.price / fabric.meters（防除零），乘用量求和，缺失按 0，总额恒为数值
  - `resolvePatternPublicInfo(product)`：从 patternId 解析纸样公开信息（名称/品牌/编码）
  - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - _Properties: P4, P5_

- [x] 5. 实现 CommunityStore（发布/编辑/浏览）
  - publishPost / updatePost（重新快照，保留互动数据）/ unpublishPost / deletePost
  - getFeed(page, pageSize) 分页、getPostDetail、getMyPosts、getMyFavorites
  - 复用 onSyncFail 风格的错误处理
  - _Requirements: 1.1, 1.3, 1.5, 3.1, 3.2, 3.3_
  - _Properties: P4_

- [x] 6. 实现 CommunityStore 互动（点赞/收藏）
  - toggleLike(postId) 返回 { liked, likeCount }；toggleFavorite(postId)
  - 未登录时返回需登录标记，交由 UI 提示
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4_
  - _Properties: P2_

- [x] 7. 实现 QuotaService 与配置
  - QUOTA_CONFIG.FREE_MONTHLY_IMAGES = 20（集中配置）
  - checkImageQuota / incrementImageUsage（或合并为调用 RPC check_and_increment）、getUsageStatus
  - _Requirements: 8.1, 8.4, 8.5, 8.6, 8.7_
  - _Properties: P3_

- [x] 8. 扩展 Auth 门禁
  - `Auth.requirePro(featureName)`：isPro() 为真放行，否则调 Paywall.show 并返回 false
  - 确认 isPro() 的过期判断与 RPC 侧一致
  - _Requirements: 7.2, 7.3, 11.2_

### 阶段三：UI（index.html）

- [x] 9. 实现 Paywall 升级引导组件
  - 集中管理各付费点文案（image-quota / analytics）；统一弹窗样式，复用现有 overlay 风格
  - _Requirements: 11.1, 11.2, 11.3, 7.3_

- [x] 10. 图片上传入口接入配额校验
  - 现有 ImageStore.save 调用处：上传前 checkImageQuota，免费超限走 Paywall 中断；通过则上传并计数
  - 网络异常保守拒绝并提示重试
  - _Requirements: 8.1, 8.2, 8.5_
  - _Properties: P3_

- [ ] 11. 制品详情新增发布/更新入口
  - "发布为作品 / 更新作品"按钮；成本公开开关（默认关）；可编辑标题/描述
  - 无图片时提示"建议添加图片"仍允许发布
  - _Requirements: 1.1, 1.4, 2.4_

- [x] 12. 社区页面（Feed 卡片流）+ 路由
  - 侧边栏新增"社区"入口；卡片流复用现有卡片视觉；分页/滚动加载；空状态；未登录可只读浏览
  - _Requirements: 3.1, 3.2, 3.4, 3.5_

- [x] 13. 作品详情视图
  - 大图 + 结构化信息（布料用量/纸样/可选成本）+ 点赞/收藏按钮与计数与已赞状态；未登录点赞/收藏弹登录
  - _Requirements: 2.1, 2.2, 2.3, 2.5, 3.3, 4.3, 4.4, 5.4_
  - _Properties: P1, P5_

- [x] 14. 我的作品 / 我的收藏管理页
  - 我的作品：编辑/取消公开/删除；我的收藏：列表 + 取消收藏
  - _Requirements: 1.3, 5.2, 5.3_

- [x] 15. 数据统计分析视图（Pro）
  - 布料消耗趋势、成本核算、库存周转；Pro 门禁，免费看预览 + 升级引导；仅基于当前用户数据本地计算
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 16. 账户信息区展示档位与配额
  - 显示当前档位（免费版/Pro）+ 到期时间；显示"本月已新增 X / 20 张"
  - _Requirements: 11.1, 8.5_

### 阶段四：验证

- [ ] 17. RLS / RPC 安全验证（最关键）
  - 以不同用户身份验证：不能读他人非公开作品与私有库存；不能改删他人作品；不能伪造他人点赞
  - 配额 RPC：第 21 次拒绝、跨月重置、Pro 不限额
  - _Requirements: 6.1, 6.2, 6.3, 8.2, 8.3_
  - _Properties: P1, P2, P3_

- [ ] 18. 端到端流程验证
  - 发布→Feed 可见→点赞/收藏计数正确→取消公开后消失→编辑作品保留互动数据
  - show_cost=false 时对外数据不含成本；成本口径按每米单价×用量正确计算
  - _Requirements: 1.1, 3.1, 4.1, 5.1_
  - _Properties: P4, P5_

## Notes

- 后端 SQL（任务 1-3）需在 Supabase 控制台手动执行，脚本会在开始阶段一时整理提供。
- 安全底线是 RLS（任务 2、17），前端限制仅作辅助，不可作为唯一防线。
- 成本口径为方向 A（仅布料）；辅料成本待"制品-辅料联动"独立功能上线后再纳入（已记入 PROJECT-STATUS.md）。
- 本 spec 不含关注/评论/私信/交易市场/支付对接，属后续阶段。
