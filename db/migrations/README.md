# 数据库迁移（db/migrations）

存放每次**数据库结构改动**的 SQL（新增/修改表、字段、RLS 策略、RPC 函数、触发器、索引、Storage 配置等）。
目的：让 staging 和 prod 两个 Supabase 项目的 schema 保持一致，并留下可回溯的变更记录。

> 数据行（实际数据）不在这里管理，也不同步——staging 是测试数据，prod 是真实用户数据，互不污染。

## 命名规范
`YYYYMMDD_简短描述.sql`，例如：

- `20260728_add_product_notions.sql`
- `20260801_fix_showcase_rls.sql`

同一天多个改动就加序号：`20260728_1_xxx.sql` / `20260728_2_xxx.sql`。

## 每个迁移文件的写法
- 文件顶部用注释写清楚：**改了什么、为什么、日期**
- SQL 尽量写成**可重复执行**（幂等），降低两库不一致时的风险：
  - 建表：`create table if not exists ...`
  - 加列：`alter table ... add column if not exists ...`
  - 建索引：`create index if not exists ...`
  - 策略：先 `drop policy if exists <名> on <表>;` 再 `create policy ...`
  - 函数：`create or replace function ...`
  - bucket：`insert into storage.buckets (...) values (...) on conflict (id) do nothing;`

## 改动流程（重要：先 staging 后 prod）
1. 新建迁移文件，写好 SQL
2. 在 **staging** 的 SQL Editor 执行，配合本地应用（`file://` 或 `localhost` 自动连 staging）验证功能
3. 验证通过后，把**同一段 SQL** 拿到 **prod** 的 SQL Editor 再执行一次
4. 如涉及前端配合改动，一并 `git push`（线上 = prod）
5. 更新根目录 `PROJECT-STATUS.md`（若表结构变化，同步 steering 的表清单）

> ⚠️ 千万别只在一边改。忘了同步 prod 会导致线上功能报错；忘了同步 staging 会让本地测不出问题。

## 基线快照
`0000_baseline_schema.sql` 是 2026-07-27 从 prod 导出的完整结构（表/约束/函数RPC/触发器/RLS/策略/Storage），用于灾备重建或初始化新环境。它是**起点快照**，之后的结构改动一律新建增量迁移文件，不要改它。

## 环境与库的对应
- 本地 `file://` / `localhost` → **staging** 库
- 线上 `chuchengfeixu.github.io` → **prod** 库
- 切换逻辑见 `js/supabase-config.js` 的 `detectSupabaseEnv()`；临时强制：控制台 `localStorage.setItem('sewing_env','prod'|'staging')` 后刷新
