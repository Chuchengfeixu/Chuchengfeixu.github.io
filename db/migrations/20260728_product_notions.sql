-- =============================================================================
-- 20260728_product_notions.sql
-- =============================================================================
-- 目的：制品-辅料联动。新增 product_notions 关联表（结构对标 product_fabrics），
--       记录每个制品用了哪些辅料、各用多少数量，用于成本口径升级为 fabric+notion。
--
-- 字段：
--   product_id    关联制品（级联删除）
--   notion_id     关联辅料（辅料删除则置空，保留历史用量名）
--   notion_name   辅料名快照（冗余，便于展示/防辅料删除后丢名）
--   quantity_used 该制品消耗的辅料数量
--
-- 幂等：create table if not exists（约束内联，表已存在则跳过）；策略 drop if exists 再建。
-- ⚠️ 先在 staging 跑并本地验证，再到 prod 执行同一段。
-- =============================================================================

create table if not exists public.product_notions (
  id uuid not null default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  notion_id uuid references public.notions(id) on delete set null,
  notion_name text,
  quantity_used numeric(10,2),
  user_id uuid not null references auth.users(id) on delete cascade,
  constraint product_notions_pkey primary key (id)
);

alter table public.product_notions enable row level security;

drop policy if exists "Users can view own product_notions" on public.product_notions;
create policy "Users can view own product_notions" on public.product_notions
  as permissive for select to public using ((auth.uid() = user_id));

drop policy if exists "Users can insert own product_notions" on public.product_notions;
create policy "Users can insert own product_notions" on public.product_notions
  as permissive for insert to public with check ((auth.uid() = user_id));

drop policy if exists "Users can update own product_notions" on public.product_notions;
create policy "Users can update own product_notions" on public.product_notions
  as permissive for update to public using ((auth.uid() = user_id));

drop policy if exists "Users can delete own product_notions" on public.product_notions;
create policy "Users can delete own product_notions" on public.product_notions
  as permissive for delete to public using ((auth.uid() = user_id));
