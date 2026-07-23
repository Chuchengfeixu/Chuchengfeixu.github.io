-- =====================================================================
-- community-and-monetization  阶段一后端建设脚本
-- 覆盖任务 1（建表）、2（RLS）、3（RPC + 触发器）
-- 在 Supabase 控制台 → SQL Editor 中整段执行
-- 可重复执行（幂等：IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS）
-- =====================================================================

-- ---------- 任务 1：确认 profiles 档位字段 ----------
alter table public.profiles
  add column if not exists tier text not null default 'free';
alter table public.profiles
  add column if not exists tier_expires_at timestamptz;

-- ---------- 任务 1：作品快照表 ----------
create table if not exists public.showcase_posts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  product_id        uuid,                       -- 软引用原制品，用于"更新作品"重新快照
  title             text not null default '',
  description       text not null default '',
  image_url         text not null default '',
  category          text not null default '',
  finish_date       date,
  fabrics_snapshot  jsonb not null default '[]'::jsonb,   -- [{name, meters}]
  pattern_snapshot  jsonb,                                -- {name, brand, code} 可空
  cost_snapshot     jsonb,                                -- {total, currency, basis} 仅 show_cost 时有值
  show_cost         boolean not null default false,
  is_public         boolean not null default true,
  like_count        integer not null default 0,
  favorite_count    integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_showcase_public_created
  on public.showcase_posts (is_public, created_at desc);
create index if not exists idx_showcase_user
  on public.showcase_posts (user_id);

-- ---------- 任务 1：点赞表 ----------
create table if not exists public.post_likes (
  post_id     uuid not null references public.showcase_posts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ---------- 任务 1：收藏表 ----------
create table if not exists public.post_favorites (
  post_id     uuid not null references public.showcase_posts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists idx_favorites_user
  on public.post_favorites (user_id, created_at desc);

-- ---------- 任务 1：图片月度配额表 ----------
create table if not exists public.image_usage_monthly (
  user_id  uuid not null references auth.users(id) on delete cascade,
  month    text not null,                 -- 'YYYY-MM'
  count    integer not null default 0,
  primary key (user_id, month)
);


-- =====================================================================
-- 任务 2：RLS 策略
-- =====================================================================

alter table public.showcase_posts      enable row level security;
alter table public.post_likes          enable row level security;
alter table public.post_favorites      enable row level security;
alter table public.image_usage_monthly enable row level security;

-- showcase_posts：公开作品任何人可读；仅本人可写
drop policy if exists "showcase read public or own" on public.showcase_posts;
create policy "showcase read public or own" on public.showcase_posts
  for select using (is_public = true or user_id = auth.uid());

drop policy if exists "showcase insert own" on public.showcase_posts;
create policy "showcase insert own" on public.showcase_posts
  for insert with check (user_id = auth.uid());

drop policy if exists "showcase update own" on public.showcase_posts;
create policy "showcase update own" on public.showcase_posts
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "showcase delete own" on public.showcase_posts;
create policy "showcase delete own" on public.showcase_posts
  for delete using (user_id = auth.uid());

-- post_likes：任何人可读（用于展示），仅本人可写自己的记录
drop policy if exists "likes read all" on public.post_likes;
create policy "likes read all" on public.post_likes
  for select using (true);

drop policy if exists "likes write own" on public.post_likes;
create policy "likes write own" on public.post_likes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- post_favorites：仅本人可读写（收藏是私人的）
drop policy if exists "favorites read own" on public.post_favorites;
create policy "favorites read own" on public.post_favorites
  for select using (user_id = auth.uid());

drop policy if exists "favorites write own" on public.post_favorites;
create policy "favorites write own" on public.post_favorites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- image_usage_monthly：仅本人可读；写入只经 security definer RPC（下方），不开放直接写策略
drop policy if exists "usage read own" on public.image_usage_monthly;
create policy "usage read own" on public.image_usage_monthly
  for select using (user_id = auth.uid());


-- =====================================================================
-- 任务 3：配额 RPC（原子校验 + 计数，含 Pro/过期判断）
-- =====================================================================

create or replace function public.check_and_increment_image_quota()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_month     text := to_char(now(), 'YYYY-MM');
  v_tier      text;
  v_expires   timestamptz;
  v_count     integer;
  v_limit     integer := 20;   -- 免费月度额度，与前端 QUOTA_CONFIG 保持一致
  v_is_pro    boolean;
begin
  if v_uid is null then
    return jsonb_build_object('allowed', false, 'used', 0, 'limit', v_limit, 'reason', 'not_authenticated');
  end if;

  select tier, tier_expires_at into v_tier, v_expires
    from public.profiles where id = v_uid;

  -- Pro 且未过期 → 不限额
  v_is_pro := (v_tier = 'pro' and (v_expires is null or v_expires > now()));
  if v_is_pro then
    return jsonb_build_object('allowed', true, 'used', -1, 'limit', -1, 'pro', true);
  end if;

  -- 确保当月行存在并加行锁
  insert into public.image_usage_monthly(user_id, month, count)
    values (v_uid, v_month, 0)
    on conflict (user_id, month) do nothing;

  select count into v_count
    from public.image_usage_monthly
    where user_id = v_uid and month = v_month
    for update;

  if v_count >= v_limit then
    return jsonb_build_object('allowed', false, 'used', v_count, 'limit', v_limit, 'reason', 'quota_exceeded');
  end if;

  update public.image_usage_monthly
    set count = count + 1
    where user_id = v_uid and month = v_month;

  return jsonb_build_object('allowed', true, 'used', v_count + 1, 'limit', v_limit);
end;
$$;

-- 只读查询当月用量（供 UI 展示 "X / 20"，不改计数）
create or replace function public.get_image_usage()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_month   text := to_char(now(), 'YYYY-MM');
  v_tier    text;
  v_expires timestamptz;
  v_count   integer := 0;
  v_limit   integer := 20;
begin
  if v_uid is null then
    return jsonb_build_object('used', 0, 'limit', v_limit, 'pro', false);
  end if;
  select tier, tier_expires_at into v_tier, v_expires
    from public.profiles where id = v_uid;
  if (v_tier = 'pro' and (v_expires is null or v_expires > now())) then
    return jsonb_build_object('used', -1, 'limit', -1, 'pro', true);
  end if;
  select coalesce(count, 0) into v_count
    from public.image_usage_monthly
    where user_id = v_uid and month = v_month;
  return jsonb_build_object('used', coalesce(v_count, 0), 'limit', v_limit, 'pro', false);
end;
$$;


-- =====================================================================
-- 任务 3：点赞 / 收藏计数触发器
-- =====================================================================

create or replace function public.trg_post_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.showcase_posts set like_count = like_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.showcase_posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists post_likes_count on public.post_likes;
create trigger post_likes_count
  after insert or delete on public.post_likes
  for each row execute function public.trg_post_likes_count();

create or replace function public.trg_post_favorites_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.showcase_posts set favorite_count = favorite_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.showcase_posts set favorite_count = greatest(favorite_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists post_favorites_count on public.post_favorites;
create trigger post_favorites_count
  after insert or delete on public.post_favorites
  for each row execute function public.trg_post_favorites_count();

-- =====================================================================
-- 执行完成。可选自检：
--   select * from public.showcase_posts limit 1;
--   select public.get_image_usage();
-- =====================================================================
