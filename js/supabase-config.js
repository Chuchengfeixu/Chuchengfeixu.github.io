// ===== Supabase 配置 · dev/prod 环境隔离 =====
// prod   = GitHub Pages 线上正式库
// staging = 本地开发 / 测试库（新建第二个 Supabase project 后填入下方凭据）
//
// 切换规则（detectSupabaseEnv）：
//   localhost / 127.0.0.1 / file:// / *.local  → staging
//   其余（含 github.io）                        → prod
// 手动覆盖：控制台执行 localStorage.setItem('sewing_env','prod'|'staging') 后刷新；
//           清除：localStorage.removeItem('sewing_env')
var SUPABASE_ENVS = {
  prod: {
    url: 'https://xvelfruexeyqtdxarwcd.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2ZWxmcnVleGV5cXRkeGFyd2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzA3ODIsImV4cCI6MjA5NjY0Njc4Mn0.H5TIRfDCgdRmVM9L2yKH5uVWDx6Gt94PBbXPjQS6bHo'
  },
  staging: {
    // staging 库（本地开发 / 测试用）。URL 用项目根地址，不带 /rest/v1/
    url: 'https://qlwgpngzdwdvksbxbzdy.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsd2dwbmd6ZHdkdmtzYnhiemR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NzcyNTQsImV4cCI6MjEwMDQ1MzI1NH0.HxYuNB7o5a8GYgNczoRb6HMPH5vr7iliv9xi8Dexsks'
  }
};

function detectSupabaseEnv() {
  var override = null;
  try { override = localStorage.getItem('sewing_env'); } catch (e) {}
  if (override === 'prod' || override === 'staging') return override;
  var h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1' || h === '' || /\.local$/.test(h)) return 'staging';
  return 'prod';
}

var SUPABASE_ENV = detectSupabaseEnv();
var _envCfg = SUPABASE_ENVS[SUPABASE_ENV];
// staging 未填凭据时兜底回 prod，避免本地开发直接连不上而崩溃
if (!_envCfg || !_envCfg.url || !_envCfg.anonKey) {
  if (SUPABASE_ENV !== 'prod') {
    console.warn('[supabase-config] "' + SUPABASE_ENV + '" 环境未配置凭据，暂时回退到 prod。请在 supabase-config.js 的 SUPABASE_ENVS.staging 填入 URL / anonKey。');
  }
  SUPABASE_ENV = 'prod';
  _envCfg = SUPABASE_ENVS.prod;
}
var SUPABASE_URL = _envCfg.url;
var SUPABASE_ANON_KEY = _envCfg.anonKey;

// 初始化 Supabase 客户端
// CDN v2 暴露的全局对象可能是 window.supabase 或 window.supabase.createClient
var supabaseClient;
if (window.supabase && window.supabase.createClient) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else if (window.supabase && window.supabase.SupabaseClient) {
  supabaseClient = new window.supabase.SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  console.error('[supabase-config] window.supabase 对象异常:', window.supabase);
}
Logger.log('[supabase-config] 当前环境:', SUPABASE_ENV, '→', SUPABASE_URL);
Logger.log('[supabase-config] supabaseClient:', supabaseClient ? '初始化成功' : '初始化失败');
Logger.log('[supabase-config] auth:', supabaseClient && supabaseClient.auth ? '存在' : '不存在');
