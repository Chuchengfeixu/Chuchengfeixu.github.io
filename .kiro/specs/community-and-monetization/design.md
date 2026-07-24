# Design Document

## Overview

本设计覆盖两块功能：**社区作品展示（一阶段）** 与 **付费功能点（第一批：图片月度配额 + 数据统计分析）**。

设计原则：

1. **不引入独立后端**：全部基于 Supabase（Postgres + RLS + Storage + RPC）实现，保持 GitHub Pages 纯静态部署。
2. **复用现有数据层与认证**：扩展 `js/data-layer.js` 的 `Store` 与 `js/auth.js`，不重写。
3. **安全底线是 RLS**：私有库存表策略不放宽；社区可读性通过独立的作品表 + 快照字段实现，前端限制只作辅助。
4. **快照而非实时联查**：作品发布 / 更新时把需公开的布料 / 纸样 / 成本信息快照进作品记录，浏览时不触碰发布者私有表。

---

## Architecture

### 高层结构

```
┌──────────────────────────────────────────────┐
│                前端 (index.html)               │
│                                                │
│  ┌───────────┐  ┌────────────┐  ┌───────────┐ │
│  │ 社区页面   │  │ 作品详情    │  │ 升级引导   │ │
│  │ Community │  │ PostDetail │  │ Paywall   │ │
│  └─────┬─────┘  └─────┬──────┘  └─────┬─────┘ │
│        │              │               │       │
│  ┌─────┴──────────────┴───────────────┴─────┐ │
│  │      CommunityStore / QuotaService        │ │
│  │      (data-layer.js 扩展)                  │ │
│  └─────┬──────────────────────────┬──────────┘ │
│        │                          │            │
│  ┌─────┴──────┐            ┌──────┴─────────┐  │
│  │ Auth/tier  │            │ 现有 Store      │  │
│  │ (isPro())  │            │ (库存数据)      │  │
│  └────────────┘            └────────────────┘  │
└───────────────────┬────────────────────────────┘
                    │ supabase-js
┌───────────────────┴────────────────────────────┐
│                  Supabase                        │
│  公开可读表: showcase_posts                      │
│  互动表: post_likes, post_favorites              │
│  配额表: image_usage_monthly                     │
│  RPC: publish_post, toggle_like, check_quota     │
│  私有库存表(不变): fabrics/products/...(RLS本人)  │
└──────────────────────────────────────────────────┘
```

### 关键数据流

**发布作品**：用户在制品详情点"发布" → 前端聚合该制品的公开字段（名称、图片 URL、纸样信息、可选最终成本；不含布料/辅料明细）→ 写入 `showcase_posts`（快照）→ Feed 可见。

**浏览 Feed**：任何人（含未登录）读 `showcase_posts`（RLS 允许读 `is_public = true`）→ 不查发布者私有表。

**点赞 / 收藏**：登录用户写 `post_likes` / `post_favorites`（RLS 校验 `user_id = auth.uid()`）→ 计数通过视图或触发器维护。

**图片配额**：上传前调用 `check_and_increment_image_quota` RPC → 后端校验当月计数 + tier → 允许则计数 +1，否则拒绝。

---

## Components and Interfaces

### 1. 数据库层（Supabase）

新增表与 RPC，详见 Data Models 一节。RLS 策略是本模块的安全核心。

### 2. CommunityStore（data-layer.js 扩展）

在现有 IIFE 内新增，暴露到 `window.CommunityStore`：

```javascript
window.CommunityStore = {
  // 发布 / 更新：从制品聚合公开字段快照并写入 showcase_posts
  publishPost: async function(productId, options) { /* options: { showCost, title, description } */ },
  updatePost: async function(postId, options) { /* 重新快照，保留互动数据 */ },
  unpublishPost: async function(postId) { /* is_public = false */ },
  deletePost: async function(postId) { },

  // Feed 浏览（分页）
  getFeed: async function(page, pageSize) { /* 返回公开作品列表 */ },
  getPostDetail: async function(postId) { },
  getMyPosts: async function() { },

  // 互动
  toggleLike: async function(postId) { /* 返回 { liked, likeCount } */ },
  toggleFavorite: async function(postId) { },
  getMyFavorites: async function() { }
};
```

**快照聚合逻辑**（publishPost / updatePost 共用）：

```javascript
function buildSnapshot(product, options) {
  return {
    product_id: product.id,
    title: options.title || product.name,
    description: options.description || '',
    image_url: product.image || '',
    category: product.category || '',
    finish_date: product.completedDate || null,
    // 社区仅展示最终成本，不公开布料/辅料明细，故快照不写入用量列表（存空数组）
    fabrics_snapshot: [],
    // 纸样快照
    pattern_snapshot: product.patternId ? resolvePatternPublicInfo(product) : null,
    // 成本：默认不含，showCost 时才计算并写入
    cost_snapshot: options.showCost ? computeCost(product) : null,
    show_cost: !!options.showCost
  };
}
```

**成本口径（方向 A：仅布料）**：

当前数据模型中制品仅通过 `product_fabrics` 关联布料，辅料（notions）为独立库存表、无"制品-辅料"关联，故成本口径为**仅布料成本**：

**重要：`fabric.price` 语义已核实** —— 它是"整匹布的总价"，而非每米单价。系统中每米单价 = `price / meters`（见 `Calculator.unitPrice`）。因此用量成本必须用每米单价乘以用量：

```javascript
function computeCost(product) {
  // 成本 = Σ( (布料总价 / 布料总米数) × 该制品用量米数 )
  // price(总价) 与 metersUsed(用量) 非必填，缺失均按 0 计
  // 布料总米数为 0 时无法得出每米单价，该项计 0，避免除零
  // 即使总额为 0 也返回数值（0），不返回 null
  var total = 0;
  (product.fabricUsages || []).forEach(function(u) {
    var fabric = Store.getById('sewing_fabrics', u.fabricId);
    var totalPrice = (fabric && parseFloat(fabric.price)) || 0;   // 整匹总价，缺失→0
    var totalMeters = (fabric && parseFloat(fabric.meters)) || 0; // 整匹米数
    var unitPrice = totalMeters > 0 ? (totalPrice / totalMeters) : 0; // 每米单价，防除零
    var used = parseFloat(u.metersUsed) || 0;                     // 用量，缺失→0
    total += unitPrice * used;
  });
  return { total: Math.round(total * 100) / 100, currency: 'CNY', basis: 'fabric-only' };
}
```

> 辅料成本待"制品-辅料联动"功能上线后再纳入，届时 `basis` 升级为 `fabric+notion`。

### 3. QuotaService（data-layer.js 扩展）

```javascript
window.QuotaService = {
  // 上传图片前调用；返回 { allowed, used, limit }
  checkImageQuota: async function() { },
  // 上传成功后计数 +1（或在 checkAndIncrement 中原子完成）
  incrementImageUsage: async function() { },
  // 展示用："本月已新增 X / 20"
  getUsageStatus: async function() { }
};

var QUOTA_CONFIG = { FREE_MONTHLY_IMAGES: 20 };  // 需求 8.6：集中配置
```

图片上传入口（现有 ImageStore.save 的调用处）改造为：先 `checkImageQuota()`，免费用户超限则弹 Paywall 并中断；通过则正常上传并计数。

### 4. Auth / tier 门禁（auth.js 扩展）

复用现有 `Auth.isPro()`，新增统一门禁辅助：

```javascript
Auth.requirePro = function(featureName) {
  if (this.isPro()) return true;
  Paywall.show(featureName);  // 统一升级引导
  return false;
};
```

`isPro()` 已含过期判断（需求 7.2 已满足）。

### 5. Paywall（升级引导组件，index.html 新增）

统一的升级引导弹窗，集中管理文案（需求 11.3）：

```javascript
var Paywall = {
  FEATURES: {
    'image-quota': { title: '图片额度已用完', desc: '本月免费额度 20 张已用完，升级 Pro 无限上传' },
    'analytics':   { title: '数据分析是 Pro 功能', desc: '解锁布料消耗趋势、成本核算、库存周转' }
  },
  show: function(featureKey) { /* 渲染弹窗 */ }
};
```

### 6. 社区 UI（index.html 新增页面）

- 侧边栏新增"社区"入口
- **社区页（Feed）**：卡片流，复用现有 `.fabric-card` / `.product-card` 视觉风格；卡片显示图片、标题、点赞数、收藏按钮
- **作品详情**：大图 + 结构化信息（纸样、可选最终成本；不含布料/辅料明细）+ 点赞/收藏
- **我的作品 / 我的收藏**：列表管理，发布者可编辑/取消公开/删除
- **制品详情**：新增"发布为作品 / 更新作品"按钮
- **账户信息区**：展示档位与本月图片配额

---

## Data Models

### 表：showcase_posts（作品，公开可读）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| user_id | uuid FK→auth.users | 发布者 |
| product_id | uuid | 关联原制品（软引用，用于"更新作品"重新快照） |
| title | text | 标题（默认取制品名） |
| description | text | 发布者补充描述 |
| image_url | text | 图片快照 |
| category | text | 分类快照 |
| finish_date | date | 完成日期快照 |
| fabrics_snapshot | jsonb | 保留列，现固定存空数组 `[]`（社区不公开布料/辅料明细） |
| pattern_snapshot | jsonb | `{name, brand, code}` 纸样快照，可空 |
| cost_snapshot | jsonb | 成本快照，仅 show_cost 时有值 |
| show_cost | boolean | 是否公开成本，默认 false |
| is_public | boolean | 是否可见，默认 true |
| like_count | int | 点赞计数（触发器维护） |
| favorite_count | int | 收藏计数（触发器维护） |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 表：post_likes（点赞）

| 字段 | 类型 | 说明 |
|------|------|------|
| post_id | uuid FK→showcase_posts | |
| user_id | uuid FK→auth.users | |
| created_at | timestamptz | |

主键：`(post_id, user_id)` → 保证同一用户对同一作品仅一条（需求 4.5）。

### 表：post_favorites（收藏）

结构同 post_likes，主键 `(post_id, user_id)`（需求 5.5）。

### 表：image_usage_monthly（图片月度配额）

| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | uuid FK→auth.users | |
| month | text | 'YYYY-MM' |
| count | int | 当月新增图片数 |

主键：`(user_id, month)`。进入新月份即新行，天然实现"按月重置"（需求 8.3）。

### RPC：check_and_increment_image_quota()

原子操作，避免并发绕过（需求 8.7）：

```sql
create or replace function check_and_increment_image_quota()
returns jsonb language plpgsql security definer as $$
declare
  v_uid uuid := auth.uid();
  v_month text := to_char(now(), 'YYYY-MM');
  v_tier text;
  v_count int;
  v_limit int := 20;
begin
  select tier into v_tier from profiles where id = v_uid;
  -- Pro（未过期）不限额
  if v_tier = 'pro' then
    return jsonb_build_object('allowed', true, 'used', -1, 'limit', -1);
  end if;
  insert into image_usage_monthly(user_id, month, count)
    values (v_uid, v_month, 0)
    on conflict (user_id, month) do nothing;
  select count into v_count from image_usage_monthly
    where user_id = v_uid and month = v_month for update;
  if v_count >= v_limit then
    return jsonb_build_object('allowed', false, 'used', v_count, 'limit', v_limit);
  end if;
  update image_usage_monthly set count = count + 1
    where user_id = v_uid and month = v_month;
  return jsonb_build_object('allowed', true, 'used', v_count + 1, 'limit', v_limit);
end; $$;
```

> 注：Pro 过期判断若依赖 `tier_expires_at`，RPC 内需一并校验，与前端 `isPro()` 保持一致。

### RLS 策略要点

```sql
-- showcase_posts：公开作品任何人可读；仅本人可写
alter table showcase_posts enable row level security;
create policy "read public posts" on showcase_posts
  for select using (is_public = true or user_id = auth.uid());
create policy "insert own posts" on showcase_posts
  for insert with check (user_id = auth.uid());
create policy "update own posts" on showcase_posts
  for update using (user_id = auth.uid());
create policy "delete own posts" on showcase_posts
  for delete using (user_id = auth.uid());

-- post_likes / post_favorites：任何人可读计数来源，仅本人可写自己的记录
create policy "read likes" on post_likes for select using (true);
create policy "write own like" on post_likes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- image_usage_monthly：仅本人可读，写入只经 RPC（security definer）
alter table image_usage_monthly enable row level security;
create policy "read own usage" on image_usage_monthly
  for select using (user_id = auth.uid());
```

私有库存表（fabrics/products/product_fabrics/patterns/notions/scraps）的 RLS **保持不变**（仅本人可读写，需求 6.4）。

### 计数维护（触发器）

`post_likes` / `post_favorites` 增删时，通过触发器同步更新 `showcase_posts.like_count / favorite_count`，避免浏览时实时 count 带来的性能问题。

---

## Error Handling

- **发布失败（网络/RLS 拒绝）**：复用现有 `onSyncFail` 风格，Toast 提示且不留半成品记录。
- **配额 RPC 失败**：网络异常时保守拒绝上传并提示"无法校验额度，请稍后重试"，避免绕过。
- **未登录互动**：点赞/收藏/发布前先判 `Auth.currentUser`，无则弹登录（需求 4.4 / 5.4）。
- **原制品已删除后浏览作品**：作品是快照，仍可正常展示；"更新作品"时若原制品不存在则禁用更新并提示。
- **Pro 过期**：`isPro()` 与 RPC 双侧按 free 处理，功能收回但已产生的数据保留。

---

## Testing Strategy

考虑到纯前端 + Supabase，测试分三层：

1. **RLS / RPC 层（最关键）**：用 Supabase SQL 或脚本以不同用户身份验证：
   - A 用户不能读 B 的非公开作品与私有库存
   - 非本人不能改/删他人作品、不能伪造他人点赞
   - 配额 RPC 在第 21 次上传时拒绝；跨月重置；Pro 不限额
2. **数据层单元验证**：`buildSnapshot` 字段映射、成本开关、快照不含私有价格（showCost=false 时）
3. **交互流程验证**：发布→Feed 可见→点赞/收藏计数正确→取消公开后 Feed 消失→编辑作品保留互动数据

关键正确性属性（用于后续 PBT / 手工核对）：

- **P1 隔离性**：任意非公开作品与任意私有库存行，对非所有者查询恒不可见。
- **P2 幂等点赞**：同一用户重复点赞，likeCount 变化 ∈ {+1, -1}，且 post_likes 中该 (post,user) 至多一行。
- **P3 配额单调**：免费用户当月成功上传次数 ≤ 20；第 21 次必被拒。
- **P4 快照一致**：作品展示的字段恒等于最近一次发布/更新时的制品快照，不随原制品后续改动而变，直到再次"更新作品"。

---

## Correctness Properties

以下为本设计必须始终保持的正确性属性，用于后续属性测试（PBT）与人工核对：

### Property 1: 隔离性（Isolation）

对任意非所有者的查询，任意 `is_public = false` 的作品与任意私有库存行（fabrics/products/...）恒不可见。这是安全底线。

**Validates: Requirements 6.1, 6.2, 6.4**

### Property 2: 点赞 / 收藏幂等（Idempotent Interaction）

同一用户对同一作品的连续点赞操作，`like_count` 的净变化只可能是 +1 或 -1；`post_likes` 中该 `(post_id, user_id)` 组合至多存在一行。收藏同理。

**Validates: Requirements 4.5, 5.5**

### Property 3: 配额单调（Quota Monotonic）

免费用户在任一自然月内成功上传的图片次数恒 ≤ 20；第 21 次上传必定被拒绝；进入新自然月后计数归零。Pro 用户不受此约束。

**Validates: Requirements 8.1, 8.2, 8.3**

### Property 4: 快照一致（Snapshot Consistency）

作品展示的所有字段恒等于最近一次"发布 / 更新作品"时对原制品的快照，不随原制品后续改动而变化，直至发布者再次触发"更新作品"。

**Validates: Requirements 1.1, 2.2, 2.3**

### Property 5: 成本保密（Cost Privacy）

当作品 `show_cost = false` 时，其对外可读数据（含 `cost_snapshot`）不得包含任何价格 / 成本数值。

**Validates: Requirements 2.4**

## 改动清单（映射到实现）

**数据库（Supabase 控制台执行 SQL）**
1. 建表：showcase_posts、post_likes、post_favorites、image_usage_monthly
2. 建 RPC：check_and_increment_image_quota（含 Pro/过期判断）
3. 建触发器：点赞/收藏计数维护
4. 配置全部新表的 RLS 策略
5. 确认 profiles 有 tier / tier_expires_at 字段

**js/data-layer.js**
6. 新增 CommunityStore（发布/更新/取消/删除、Feed 分页、详情、我的作品/收藏）
7. 新增 buildSnapshot / computeCost / resolvePatternPublicInfo 辅助
8. 新增 QuotaService（checkImageQuota / incrementImageUsage / getUsageStatus）+ QUOTA_CONFIG

**js/auth.js**
9. 新增 Auth.requirePro(featureName) 统一门禁

**index.html**
10. 图片上传入口接入配额校验（免费超限走 Paywall）
11. Paywall 升级引导组件（集中文案）
12. 社区页面（Feed 卡片流）+ 路由入口
13. 作品详情视图（结构化信息 + 点赞/收藏）
14. 我的作品 / 我的收藏管理页
15. 制品详情新增"发布为作品 / 更新作品"入口 + 成本公开开关
16. 数据统计分析视图（Pro 门禁，免费看预览+引导）
17. 账户区展示档位 + 本月图片配额状态

**sw.js**
18. 社区页面属动态数据，无需静态缓存；确认 SW 不缓存 Supabase 请求（现状已满足）
