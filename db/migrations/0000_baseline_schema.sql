-- =============================================================================
-- 0000_baseline_schema.sql —— 数据库基线快照
-- =============================================================================
-- 用途：记录 prod/staging 当前的完整结构，用于灾备重建或初始化新环境。
-- 提取时间：2026-07-27（从 prod ref xvelfruexeyqtdxarwcd 导出，staging 已同步一致）
-- 执行顺序：表 → 约束 → 函数/RPC → 触发器 → 开启 RLS → 策略 → Storage bucket
--
-- 说明：
--   * 这是「起点快照」，之后的结构改动请新建增量迁移（如 20260728_xxx.sql），别改本文件。
--   * 幂等：建表/策略/bucket 已做 if not exists / on conflict，可重复执行。
--     （策略若重名会报错，重跑前可先 drop policy if exists，或忽略"已存在"报错。）
--   * 建表语句未带 public. 前缀，请在 public schema（SQL Editor 默认 search_path）下执行。
-- =============================================================================


-- ==================== 1. 表 (tables) ====================

create table if not exists public.fabrics (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  shop text,
  category text,
  color text,
  meters numeric(10,2),
  price numeric(10,2),
  remaining numeric(10,2),
  weight text,
  rating integer default 0,
  image_url text,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  code text default ''::text,
  width text default ''::text,
  purchase_date date,
  printed boolean default false,
  printed_at timestamp with time zone
);

create table if not exists public.image_usage_monthly (
  user_id uuid not null,
  month text not null,
  count integer not null default 0
);

create table if not exists public.notions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  category text,
  quantity integer default 0,
  unit text,
  price numeric(10,2),
  shop text,
  image_url text,
  notes text,
  created_at timestamp with time zone default now(),
  purchase_date date
);

create table if not exists public.patterns (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  source text,
  category text,
  size text,
  image_url text,
  notes text,
  created_at timestamp with time zone default now(),
  code text default ''::text,
  link text default ''::text
);

create table if not exists public.post_favorites (
  post_id uuid not null,
  user_id uuid not null,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.post_likes (
  post_id uuid not null,
  user_id uuid not null,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.product_fabrics (
  id uuid not null default gen_random_uuid(),
  product_id uuid not null,
  fabric_id uuid,
  fabric_name text,
  meters_used numeric(10,2),
  user_id uuid not null
);

create table if not exists public.products (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  category text,
  status text default 'planned'::text,
  start_date date,
  finish_date date,
  image_url text,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  sewn_by text default ''::text,
  pattern_source text default ''::text,
  pattern_id uuid,
  pattern_type text default ''::text,
  pattern_code text default ''::text,
  tutorial_link text default ''::text,
  quantity integer default 1
);

create table if not exists public.profiles (
  id uuid not null,
  email text,
  nickname text,
  tier text default 'free'::text,
  tier_expires_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  role text default 'user'::text
);

create table if not exists public.scraps (
  id uuid not null,
  user_id uuid,
  fabric_id uuid,
  fabric_name text,
  meters numeric default 0,
  scrap_date date,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.showcase_posts (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  product_id uuid,
  title text not null default ''::text,
  description text not null default ''::text,
  image_url text not null default ''::text,
  category text not null default ''::text,
  finish_date date,
  fabrics_snapshot jsonb not null default '[]'::jsonb,
  pattern_snapshot jsonb,
  cost_snapshot jsonb,
  show_cost boolean not null default false,
  is_public boolean not null default true,
  like_count integer not null default 0,
  favorite_count integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.todos (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  note text,
  image_url text,
  sort_order integer default 0,
  completed boolean default false,
  created_at timestamp with time zone default now(),
  category text default ''::text
);


-- ==================== 2. 约束 (PK / 唯一 / 外键 / CHECK) ====================

-- 主键
alter table fabrics add constraint fabrics_pkey PRIMARY KEY (id);
alter table image_usage_monthly add constraint image_usage_monthly_pkey PRIMARY KEY (user_id, month);
alter table notions add constraint notions_pkey PRIMARY KEY (id);
alter table patterns add constraint patterns_pkey PRIMARY KEY (id);
alter table post_favorites add constraint post_favorites_pkey PRIMARY KEY (post_id, user_id);
alter table post_likes add constraint post_likes_pkey PRIMARY KEY (post_id, user_id);
alter table product_fabrics add constraint product_fabrics_pkey PRIMARY KEY (id);
alter table products add constraint products_pkey PRIMARY KEY (id);
alter table profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table scraps add constraint scraps_pkey PRIMARY KEY (id);
alter table showcase_posts add constraint showcase_posts_pkey PRIMARY KEY (id);
alter table todos add constraint todos_pkey PRIMARY KEY (id);

-- CHECK
alter table fabrics add constraint fabrics_rating_check CHECK (((rating >= 0) AND (rating <= 5)));
alter table profiles add constraint profiles_tier_check CHECK ((tier = ANY (ARRAY['free'::text, 'pro'::text])));

-- 外键
alter table fabrics add constraint fabrics_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table image_usage_monthly add constraint image_usage_monthly_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table notions add constraint notions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table patterns add constraint patterns_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table post_favorites add constraint post_favorites_post_id_fkey FOREIGN KEY (post_id) REFERENCES showcase_posts(id) ON DELETE CASCADE;
alter table post_favorites add constraint post_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table post_likes add constraint post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES showcase_posts(id) ON DELETE CASCADE;
alter table post_likes add constraint post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table product_fabrics add constraint product_fabrics_fabric_id_fkey FOREIGN KEY (fabric_id) REFERENCES fabrics(id) ON DELETE SET NULL;
alter table product_fabrics add constraint product_fabrics_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
alter table product_fabrics add constraint product_fabrics_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table products add constraint products_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table scraps add constraint scraps_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table showcase_posts add constraint showcase_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table todos add constraint todos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- ==================== 3. 函数 / RPC (functions) ====================

-- 图片配额：原子校验并 +1（免费 20 张/月；Pro 不限）。与前端 QUOTA_CONFIG 保持一致。
CREATE OR REPLACE FUNCTION public.check_and_increment_image_quota()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

-- 只读查询本月图片用量
CREATE OR REPLACE FUNCTION public.get_image_usage()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

-- 新用户注册后自动建 profiles 行
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$function$;

-- 收藏计数维护
CREATE OR REPLACE FUNCTION public.trg_post_favorites_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    update public.showcase_posts set favorite_count = favorite_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.showcase_posts set favorite_count = greatest(favorite_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$function$;

-- 点赞计数维护
CREATE OR REPLACE FUNCTION public.trg_post_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    update public.showcase_posts set like_count = like_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.showcase_posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$function$;


-- ==================== 4. 触发器 (triggers, 含 auth) ====================

CREATE TRIGGER post_favorites_count AFTER INSERT OR DELETE ON public.post_favorites FOR EACH ROW EXECUTE FUNCTION trg_post_favorites_count();
CREATE TRIGGER post_likes_count AFTER INSERT OR DELETE ON public.post_likes FOR EACH ROW EXECUTE FUNCTION trg_post_likes_count();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ==================== 5. 开启 RLS ====================

alter table public.fabrics enable row level security;
alter table public.image_usage_monthly enable row level security;
alter table public.notions enable row level security;
alter table public.patterns enable row level security;
alter table public.post_favorites enable row level security;
alter table public.post_likes enable row level security;
alter table public.product_fabrics enable row level security;
alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.scraps enable row level security;
alter table public.showcase_posts enable row level security;
alter table public.todos enable row level security;


-- ==================== 6. RLS 策略 (policies) ====================

-- fabrics
create policy "Users can delete own fabrics" on public.fabrics as permissive for delete to public using ((auth.uid() = user_id));
create policy "Users can insert own fabrics" on public.fabrics as permissive for insert to public with check ((auth.uid() = user_id));
create policy "Users can update own fabrics" on public.fabrics as permissive for update to public using ((auth.uid() = user_id));
create policy "Users can view own fabrics" on public.fabrics as permissive for select to public using ((auth.uid() = user_id));

-- image_usage_monthly
create policy "usage read own" on public.image_usage_monthly as permissive for select to public using ((user_id = auth.uid()));

-- notions
create policy "Users can delete own notions" on public.notions as permissive for delete to public using ((auth.uid() = user_id));
create policy "Users can insert own notions" on public.notions as permissive for insert to public with check ((auth.uid() = user_id));
create policy "Users can update own notions" on public.notions as permissive for update to public using ((auth.uid() = user_id));
create policy "Users can view own notions" on public.notions as permissive for select to public using ((auth.uid() = user_id));

-- patterns
create policy "Users can delete own patterns" on public.patterns as permissive for delete to public using ((auth.uid() = user_id));
create policy "Users can insert own patterns" on public.patterns as permissive for insert to public with check ((auth.uid() = user_id));
create policy "Users can update own patterns" on public.patterns as permissive for update to public using ((auth.uid() = user_id));
create policy "Users can view own patterns" on public.patterns as permissive for select to public using ((auth.uid() = user_id));

-- post_favorites
create policy "favorites read own" on public.post_favorites as permissive for select to public using ((user_id = auth.uid()));
create policy "favorites write own" on public.post_favorites as permissive for all to public using ((user_id = auth.uid())) with check ((user_id = auth.uid()));

-- post_likes
create policy "likes read all" on public.post_likes as permissive for select to public using (true);
create policy "likes write own" on public.post_likes as permissive for all to public using ((user_id = auth.uid())) with check ((user_id = auth.uid()));

-- product_fabrics
create policy "Users can delete own product_fabrics" on public.product_fabrics as permissive for delete to public using ((auth.uid() = user_id));
create policy "Users can insert own product_fabrics" on public.product_fabrics as permissive for insert to public with check ((auth.uid() = user_id));
create policy "Users can update own product_fabrics" on public.product_fabrics as permissive for update to public using ((auth.uid() = user_id));
create policy "Users can view own product_fabrics" on public.product_fabrics as permissive for select to public using ((auth.uid() = user_id));

-- products
create policy "Users can delete own products" on public.products as permissive for delete to public using ((auth.uid() = user_id));
create policy "Users can insert own products" on public.products as permissive for insert to public with check ((auth.uid() = user_id));
create policy "Users can update own products" on public.products as permissive for update to public using ((auth.uid() = user_id));
create policy "Users can view own products" on public.products as permissive for select to public using ((auth.uid() = user_id));

-- profiles
create policy "Users can insert own profile" on public.profiles as permissive for insert to public with check ((auth.uid() = id));
create policy "Users can update own profile" on public.profiles as permissive for update to public using ((auth.uid() = id));
create policy "Users can view own profile" on public.profiles as permissive for select to public using ((auth.uid() = id));

-- scraps
create policy "Users can manage own scraps" on public.scraps as permissive for all to public using ((auth.uid() = user_id));

-- showcase_posts
create policy "showcase delete own" on public.showcase_posts as permissive for delete to public using ((user_id = auth.uid()));
create policy "showcase insert own" on public.showcase_posts as permissive for insert to public with check ((user_id = auth.uid()));
create policy "showcase read public or own" on public.showcase_posts as permissive for select to public using (((is_public = true) OR (user_id = auth.uid())));
create policy "showcase update own" on public.showcase_posts as permissive for update to public using ((user_id = auth.uid())) with check ((user_id = auth.uid()));

-- todos
create policy "Users can delete own todos" on public.todos as permissive for delete to public using ((auth.uid() = user_id));
create policy "Users can insert own todos" on public.todos as permissive for insert to public with check ((auth.uid() = user_id));
create policy "Users can update own todos" on public.todos as permissive for update to public using ((auth.uid() = user_id));
create policy "Users can view own todos" on public.todos as permissive for select to public using ((auth.uid() = user_id));

-- storage.objects（images bucket）
-- 注意：prod 现存策略有重叠（旧/新两套并存），保持原样记录。清理见文件末尾备注。
create policy "Authenticated users can upload" on storage.objects as permissive for insert to public with check (((bucket_id = 'images'::text) AND (auth.role() = 'authenticated'::text)));
create policy "Public can view images" on storage.objects as permissive for select to public using ((bucket_id = 'images'::text));
create policy "Users can delete own images" on storage.objects as permissive for delete to public using (((bucket_id = 'images'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
create policy "images modify own" on storage.objects as permissive for delete to authenticated using (((bucket_id = 'images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "images public read" on storage.objects as permissive for select to public using ((bucket_id = 'images'::text));
create policy "images update own" on storage.objects as permissive for update to authenticated using (((bucket_id = 'images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "images upload own" on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


-- ==================== 7. Storage bucket ====================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, null, null)
on conflict (id) do nothing;


-- =============================================================================
-- 备注 · storage.objects 策略冗余
-- =============================================================================
-- images bucket 上目前存在两套语义重叠的策略：
--   旧套：Authenticated users can upload / Public can view images / Users can delete own images
--   新套：images upload own / images public read / images modify own / images update own
-- 「新套」按 auth.uid() = 路径首段 做了更严格的按用户目录隔离；「旧套」较宽松。
-- 两套并存不影响安全（permissive 取并集，删除仍受新套 folder 限制约束叠加），
-- 但建议后续开一个增量迁移清理旧套，避免混淆。此处仅忠实记录 prod 当前状态。
-- =============================================================================
