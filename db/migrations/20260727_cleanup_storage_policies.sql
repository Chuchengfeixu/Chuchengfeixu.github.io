-- =============================================================================
-- 20260727_cleanup_storage_policies.sql
-- =============================================================================
-- 目的：清理 storage.objects 上 images bucket 的冗余旧策略。
--
-- 背景：images bucket 上曾有两套语义重叠的策略：
--   旧套（较宽松）：
--     - "Authenticated users can upload"  任意登录用户可上传到 images 任意路径
--     - "Public can view images"          公开读
--     - "Users can delete own images"     删除自己目录（to public）
--   新套（按用户目录严格隔离，to authenticated）：
--     - "images upload own" / "images update own" / "images modify own" / "images public read"
--
-- 应用上传路径为 `<user_id>/<uuid>.<ext>`（见 core.js ImageStore.saveToCloud），
-- 首段即用户 id，因此严格的新套策略能正常放行上传/改/删，旧套可安全移除。
--
-- 保留：images public read / images upload own / images update own / images modify own
-- 移除：下面 3 条旧策略
--
-- ⚠️ 执行顺序：先在 staging 跑并本地验证「发布作品/上传图片」正常，再在 prod 执行同一段。
-- 幂等：用 drop policy if exists，可重复执行。
-- =============================================================================

drop policy if exists "Authenticated users can upload" on storage.objects;
drop policy if exists "Public can view images" on storage.objects;
drop policy if exists "Users can delete own images" on storage.objects;
